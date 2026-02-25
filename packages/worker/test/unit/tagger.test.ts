import { describe, expect, it } from 'vitest';
import { tagEvent } from '../../src/ingest/tagger';

const taxonomy = {
  tags: ['deprecation', 'privacy'],
  rules: [{ pattern: '(?i)deprecat', add_tags: ['deprecation'], severity: 'high', event_type: 'deprecation' }],
  platform_rules: {
    meta: [{ pattern: '(?i)graph api', add_tags: ['privacy'] }],
  },
};

describe('tagEvent', () => {
  it('applies rules deterministically', () => {
    const event = tagEvent(
      {
        event_id: '1',
        source_id: 's',
        platform: 'meta',
        surface: 'api',
        event_type: 'release',
        published_at: '2026-01-01T00:00:00.000Z',
        title: 'Graph API deprecation notice',
        canonical_url: 'https://example.com',
        summary: 'Deprecated endpoint',
        raw_excerpt: 'Deprecated endpoint',
        fingerprint: 'abc',
        labels: [],
      },
      taxonomy as any,
    );
    expect(event.event_type).toBe('deprecation');
    expect(event.severity).toBe('high');
    expect(event.labels).toContain('deprecation');
    expect(event.labels).toContain('privacy');
  });
});
