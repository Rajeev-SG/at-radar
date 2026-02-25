import { XMLParser } from 'fast-xml-parser';
import type { CandidateEvent, SourceConfig } from '../../types';
import { cleanText, extractTextDeep, passesTextFilters, safeIsoDate } from '../../util';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getAtomLink(entry: any): string | undefined {
  const links = asArray(entry.link);
  const candidates = links.map((link) => (typeof link === 'string' ? { text: link } : link));
  for (const link of candidates) {
    if (link?.['@_rel'] === 'alternate' && link?.['@_type']?.includes?.('html') && link?.['@_href']) {
      return link['@_href'];
    }
  }
  for (const link of links) {
    if (typeof link === 'string') return link;
    if (link?.['@_rel'] === 'alternate' && link?.['@_href']) return link['@_href'];
    if (link?.['@_href']) return link['@_href'];
  }
  return undefined;
}

export function parseRss(source: SourceConfig, bodyText: string): CandidateEvent[] {
  const parsed = xmlParser.parse(bodyText);
  const channelItems = asArray(parsed?.rss?.channel?.item);
  const atomEntries = asArray(parsed?.feed?.entry);
  const items = channelItems.length ? channelItems : atomEntries;

  return items
    .map((item: any) => {
      const title = String(item.title?.['#text'] ?? item.title ?? '').trim();
      const rawLink = typeof item.link === 'object' ? getAtomLink(item) : item.link ?? getAtomLink(item);
      const link = String(rawLink ?? '')
        .trim()
        .replace(/^http:\/\/ads-developers\.googleblog\.com\//i, 'https://ads-developers.googleblog.com/');
      const date = safeIsoDate(item.pubDate ?? item.published ?? item.updated);
      const summary = cleanText(extractTextDeep(item.summary ?? item.description ?? item.content));
      const contentText = cleanText(extractTextDeep(item.content ?? item.summary ?? item.description));
      if (!passesTextFilters(title, {
        include: source.parse.include_title_regex as string | undefined,
        exclude: source.parse.exclude_title_regex as string | undefined,
      })) return null;
      if (!passesTextFilters(summary || contentText, {
        include: source.parse.include_summary_regex as string | undefined,
        exclude: source.parse.exclude_summary_regex as string | undefined,
      })) return null;
      if (!title || !link) return null;
      return {
        source_id: source.source_id,
        platform: source.platform,
        surface: source.surface,
        title,
        canonical_url: link,
        published_at: date,
        summary: summary || contentText,
        raw_excerpt: summary || contentText,
      } satisfies CandidateEvent;
    })
    .filter(Boolean) as CandidateEvent[];
}
