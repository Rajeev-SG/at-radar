import { describe, expect, it } from 'vitest';
import { normalizeCandidate } from '../../src/ingest/normalize';
import type { CandidateEvent, SourceConfig } from '../../src/types';

const source: SourceConfig = {
  source_id: 'test',
  platform: 'google_ads',
  surface: 'api',
  strategy: 'html_list',
  request: { url: 'https://example.com' },
  parse: {},
  rate_limit: { min_seconds_between_fetches: 60, max_items_per_run: 10 },
  cursor: { type: 'published_at' },
  tags: ['versioning'],
};

const normalization = {
  summary: { max_chars: 240, strip_html: true },
  raw_excerpt: { max_chars: 280 },
  fingerprint: { algorithm: 'sha256' },
  published_at: { allow_inferred: true },
  severity_defaults: { release: 'medium', deprecation: 'high', docs_update: 'low', breaking_change: 'high' },
};

describe('normalizeCandidate', () => {
  it('creates stable event ids and inferred published_at fallback', async () => {
    const candidate: CandidateEvent = {
      source_id: 'test',
      platform: 'google_ads',
      surface: 'api',
      title: 'Version 1 release',
      canonical_url: 'https://example.com/v1',
      summary: '<p>Shipped reporting updates</p>',
    };

    const a = await normalizeCandidate(source, candidate, normalization as any, '2026-01-01T00:00:00.000Z');
    const b = await normalizeCandidate(source, candidate, normalization as any, '2026-01-01T00:00:00.000Z');
    expect(a.event_id).toBe(b.event_id);
    expect(a.summary).toBe('Shipped reporting updates');
    expect(a.published_at_inferred).toBe(true);
  });
});
