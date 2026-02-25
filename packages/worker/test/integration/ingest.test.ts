import { describe, expect, it } from 'vitest';
import { getConfigBundle } from '../../src/ingest/config';
import { FixtureHttpClient } from '../../src/ingest/http';
import { runIngestion } from '../../src/ingest/engine';
import { listEvents } from '../../src/db/queries';
import { createTestDb, applyWorkerMigrations } from '../helpers/sqlite';
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
    'https://developers.google.com/google-ads/api/docs/client-libs': { bodyText: readFixture('html', 'docs_monitor_google_client_libs.html') },
  } as const;
}

describe('ingestion integration', () => {
  it('applies migrations, ingests fixtures, and dedupes on rerun', async () => {
    const db = createTestDb();
    applyWorkerMigrations(db);
    const env = { DB: db, APP_VERSION: 'test', RADAR_ADMIN_TOKEN: 'token' } as any;
    const httpClient = new FixtureHttpClient(fixtureMap() as any);
    const config = getConfigBundle();

    const first = await runIngestion(env, { httpClient, config, triggerType: 'test' });
    expect(first.totalEvents).toBeGreaterThan(5);

    const events1 = await listEvents(db, { limit: 100 });
    expect(events1.items.length).toBeGreaterThan(5);

    const second = await runIngestion(env, { httpClient, config, triggerType: 'test' });
    const events2 = await listEvents(db, { limit: 100 });
    expect(events2.items.length).toBe(events1.items.length);
    expect(second.totalEvents).toBeGreaterThan(0);
  });
});
