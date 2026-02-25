import { describe, expect, it } from 'vitest';
import { getConfigBundle } from '../../src/ingest/config';
import { parseHtmlList } from '../../src/ingest/strategies/html_list';
import { parseRss } from '../../src/ingest/strategies/rss';
import { parseHtmlFingerprint } from '../../src/ingest/strategies/html_fingerprint';
import { readExpected, readFixture } from '../helpers/fixtures';

const bySource = new Map(getConfigBundle().sources.map((s) => [s.source_id, s]));

function pickFields(items: any[]) {
  return items.map((item) => ({
    source_id: item.source_id,
    platform: item.platform,
    surface: item.surface,
    title: item.title,
    canonical_url: item.canonical_url,
    published_at: item.published_at,
    summary: item.summary,
    raw_excerpt: item.raw_excerpt,
  }));
}

describe('contract tests per source', () => {
  it('google_ads_api', () => {
    const source = bySource.get('google_ads_api')!;
    const parsed = parseHtmlList(source, readFixture('html', 'google_ads_api.html'), source.request.url);
    expect(pickFields(parsed)).toEqual(readExpected('google_ads_api.json'));
  });

  it('google_ads_blog', () => {
    const source = bySource.get('google_ads_blog')!;
    const parsed = parseRss(source, readFixture('rss', 'google_ads_blog.xml'));
    expect(pickFields(parsed)).toEqual(readExpected('google_ads_blog.json'));
  });

  it('meta_marketing_api', () => {
    const source = bySource.get('meta_marketing_api')!;
    const parsed = parseHtmlList(source, readFixture('html', 'meta_marketing_api.html'), source.request.url);
    expect(pickFields(parsed)).toEqual(readExpected('meta_marketing_api.json'));
  });

  it('meta_graph_api', () => {
    const source = bySource.get('meta_graph_api')!;
    const parsed = parseHtmlList(source, readFixture('html', 'meta_graph_api.html'), source.request.url);
    expect(pickFields(parsed)).toEqual(readExpected('meta_graph_api.json'));
  });

  it('tiktok_changelog', () => {
    const source = bySource.get('tiktok_changelog')!;
    const parsed = parseHtmlList(source, readFixture('html', 'tiktok_changelog.html'), source.request.url);
    expect(pickFields(parsed)).toEqual(readExpected('tiktok_changelog.json'));
  });

  it('amazon_ads_release_notes', () => {
    const source = bySource.get('amazon_ads_release_notes')!;
    const parsed = parseHtmlList(source, readFixture('html', 'amazon_ads_release_notes.html'), source.request.url);
    expect(pickFields(parsed)).toEqual(readExpected('amazon_ads_release_notes.json'));
  });

  it('amazon_ads_deprecations', () => {
    const source = bySource.get('amazon_ads_deprecations')!;
    const parsed = parseHtmlList(source, readFixture('html', 'amazon_ads_deprecations.html'), source.request.url);
    expect(pickFields(parsed)).toEqual(readExpected('amazon_ads_deprecations.json'));
  });

  it('docs_monitors fingerprint', () => {
    const source = bySource.get('docs_monitors')!;
    const parsed = parseHtmlFingerprint(
      source,
      readFixture('html', 'docs_monitor_google.html'),
      'https://developers.google.com/google-ads/api/docs/start',
      undefined,
      'google_ads_overview',
    );
    const expected = readExpected('docs_monitors.json') as any;
    expect(parsed?.title).toBe(expected.title);
    expect(parsed?.canonical_url).toBe(expected.canonical_url);
    expect(parsed?.event_type).toBe(expected.event_type);
  });
});
