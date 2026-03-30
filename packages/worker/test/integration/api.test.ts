import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleApiRequest } from '../../src/api/routes';
import { createTestDb, applyWorkerMigrations } from '../helpers/sqlite';
import { runIngestion } from '../../src/ingest/engine';
import { FixtureHttpClient } from '../../src/ingest/http';
import { getConfigBundle } from '../../src/ingest/config';
import { readFixture } from '../helpers/fixtures';

function fixtureMap() {
  return {
    'https://developers.google.com/google-ads/api/docs/release-notes': { bodyText: readFixture('html', 'google_ads_api.html') },
    'https://ads-developers.googleblog.com/feeds/posts/default': { bodyText: readFixture('rss', 'google_ads_blog.xml') },
    'https://developers.facebook.com/docs/marketing-api/marketing-api-changelog/': { bodyText: readFixture('html', 'meta_marketing_api.html') },
    'https://developers.facebook.com/docs/graph-api/changelog/': { bodyText: readFixture('html', 'meta_graph_api.html') },
    'https://developers.tiktok.com/doc/changelog': { bodyText: readFixture('html', 'tiktok_changelog.html') },
    'https://advertising.amazon.com/API/docs/en-us/release-notes/ads-api': { bodyText: readFixture('html', 'amazon_ads_release_notes.html') },
    'https://advertising.amazon.com/API/docs/en-us/release-notes/deprecations': { bodyText: readFixture('html', 'amazon_ads_deprecations.html') },
    'https://developers.google.com/google-ads/api/docs/start': { bodyText: readFixture('html', 'docs_monitor_google.html') },
    'https://developers.google.com/google-ads/api/docs/oauth/overview': { bodyText: readFixture('html', 'docs_monitor_google_auth.html') },
    'https://developers.google.com/google-ads/api/docs/client-libs': { bodyText: readFixture('html', 'docs_monitor_google_client_libs.html') }
  } as const;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api routes', () => {
  it('returns events, feeds, and detail', async () => {
    const db = createTestDb();
    applyWorkerMigrations(db);
    const env = { DB: db, APP_VERSION: 'test', RADAR_ADMIN_TOKEN: 'secret' } as any;
    await runIngestion(env, { config: getConfigBundle(), httpClient: new FixtureHttpClient(fixtureMap() as any), triggerType: 'test' });

    const health = await handleApiRequest(new Request('http://localhost/api/health'), env);
    expect(health.status).toBe(200);

    const eventsRes = await handleApiRequest(new Request('http://localhost/api/events?limit=5'), env);
    const eventsJson = await eventsRes.json() as any;
    expect(eventsJson.items.length).toBeGreaterThan(0);

    const detailRes = await handleApiRequest(new Request(`http://localhost/api/events/${eventsJson.items[0].event_id}`), env);
    expect(detailRes.status).toBe(200);
    const detailJson = await detailRes.json() as any;
    expect(detailJson.event_id).toBe(eventsJson.items[0].event_id);
    expect(detailJson.artifact).toBeTruthy();

    const rss = await handleApiRequest(new Request('http://localhost/api/feeds/rss'), env);
    expect(rss.headers.get('content-type')).toContain('application/rss+xml');
    expect(await rss.text()).toContain('<rss');

    const jsonFeed = await handleApiRequest(new Request('http://localhost/api/feeds/json'), env);
    expect(jsonFeed.headers.get('content-type')).toContain('application/feed+json');

    const unauthorized = await handleApiRequest(new Request('http://localhost/api/admin/run', { method: 'POST' }), env);
    expect(unauthorized.status).toBe(401);
  });

  it('batch enriches unenriched events and exposes enriched_article on detail responses', async () => {
    const db = createTestDb();
    applyWorkerMigrations(db);
    const env = {
      DB: db,
      APP_VERSION: 'test',
      RADAR_ADMIN_TOKEN: 'secret',
      OPENROUTER_API_KEY: 'openrouter-test-key',
    } as any;
    await runIngestion(env, { config: getConfigBundle(), httpClient: new FixtureHttpClient(fixtureMap() as any), triggerType: 'test' });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'mock-response',
          choices: [
            {
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: `===WHAT_CHANGED===
Mocked change summary.

===SO_WHAT===
Mocked impact summary.

===WHY_IT_MATTERS===
Mocked strategic summary.`,
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const enrichRes = await handleApiRequest(
      new Request('http://localhost/api/admin/enrich-all', {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ limit: 1, batch_size: 1, backoff_base_ms: 1 }),
      }),
      env,
    );
    expect(enrichRes.status).toBe(200);
    const enrichJson = await enrichRes.json() as any;
    expect(enrichJson).toMatchObject({
      processed: 1,
      succeeded: 1,
      failed: 0,
    });
    expect(enrichJson.errors).toEqual([]);

    const eventsRes = await handleApiRequest(new Request('http://localhost/api/events?limit=1'), env);
    const eventsJson = await eventsRes.json() as any;
    const detailRes = await handleApiRequest(
      new Request(`http://localhost/api/events/${eventsJson.items[0].event_id}`),
      env,
    );
    expect(detailRes.status).toBe(200);
    const detailJson = await detailRes.json() as any;
    expect(detailJson.enriched_article).toMatchObject({
      what_changed: 'Mocked change summary.',
      so_what: 'Mocked impact summary.',
      why_it_matters: 'Mocked strategic summary.',
    });
  });
});
