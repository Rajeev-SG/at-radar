import { describe, expect, it } from 'vitest';
import { parseHtmlList } from '../../src/ingest/strategies/html_list';
import { parseRss } from '../../src/ingest/strategies/rss';
import { parseJsonFeed } from '../../src/ingest/strategies/json_feed';
import { readFixture } from '../helpers/fixtures';
import type { SourceConfig } from '../../src/types';

const baseSource: Omit<SourceConfig, 'source_id' | 'platform' | 'surface' | 'strategy'> = {
  request: { url: 'https://example.com' },
  parse: {},
  rate_limit: { min_seconds_between_fetches: 60, max_items_per_run: 10 },
  cursor: { type: 'published_at' },
  tags: [],
};

describe('strategy parsers', () => {
  it('parses RSS/Atom entries', () => {
    const source: SourceConfig = { ...baseSource, source_id: 'rss', platform: 'google_ads', surface: 'api', strategy: 'rss' };
    const items = parseRss(source, readFixture('rss', 'google_ads_blog.xml'));
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('v23');
  });

  it('parses html_list headings', () => {
    const source: SourceConfig = {
      ...baseSource,
      source_id: 'h',
      platform: 'google_ads',
      surface: 'api',
      strategy: 'html_list',
      request: { url: 'https://developers.google.com/google-ads/api/docs/release-notes' },
      parse: { list_selector: 'main h2', link_selector: 'a', date_regex: '(?i)(January|December)\\s+\\d{1,2},\\s+\\d{4}' },
    };
    const items = parseHtmlList(source, readFixture('html', 'google_ads_api.html'), source.request.url);
    expect(items).toHaveLength(2);
    expect(items[0].canonical_url).toContain('#v23');
  });

  it('parses json feeds', () => {
    const source: SourceConfig = {
      ...baseSource,
      source_id: 'j',
      platform: 'google_ads',
      surface: 'api',
      strategy: 'json_feed',
      parse: { items_path: 'items' },
    };
    const items = parseJsonFeed(source, readFixture('json', 'example_feed.json'));
    expect(items[0].canonical_url).toBe('https://example.com/change-1');
  });
});
