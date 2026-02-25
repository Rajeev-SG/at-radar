import type { CandidateEvent, SourceConfig } from '../../types';
import { safeIsoDate } from '../../util';

function get(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
}

export function parseJsonFeed(source: SourceConfig, bodyText: string): CandidateEvent[] {
  const data = JSON.parse(bodyText);
  const itemsPath = String(source.parse.items_path ?? 'items');
  const mappings = (source.parse.mappings as Record<string, string> | undefined) ?? {
    title: 'title',
    link: 'url',
    date: 'published_at',
    summary: 'summary',
  };
  const items = get(data, itemsPath);
  if (!Array.isArray(items)) return [];
  return items.slice(0, source.rate_limit.max_items_per_run).flatMap((item) => {
    const title = String(get(item, mappings.title) ?? '').trim();
    const link = String(get(item, mappings.link) ?? '').trim();
    if (!title || !link) return [];
    return [{
      source_id: source.source_id,
      platform: source.platform,
      surface: source.surface,
      title,
      canonical_url: link,
      published_at: safeIsoDate(get(item, mappings.date)),
      summary: String(get(item, mappings.summary) ?? '').trim(),
    } satisfies CandidateEvent];
  });
}
