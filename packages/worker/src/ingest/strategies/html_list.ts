import * as cheerio from 'cheerio';
import type { CandidateEvent, SourceConfig } from '../../types';
import { cleanText, passesTextFilters, regexFromConfig, safeIsoDate } from '../../util';

export function parseHtmlList(source: SourceConfig, bodyText: string, baseUrl: string): CandidateEvent[] {
  const $ = cheerio.load(bodyText);
  const selector = String(source.parse.list_selector ?? 'h2');
  const linkSelector = String(source.parse.link_selector ?? 'a');
  const dateRegex = source.parse.date_regex ? regexFromConfig(String(source.parse.date_regex)) : null;
  const maxItems = source.rate_limit.max_items_per_run;

  const items: CandidateEvent[] = [];
  function extractLocalSummary(node: cheerio.Cheerio<any>): string {
    const tag = (node.get(0)?.tagName || '').toLowerCase();
    const boundary = /h[1-6]/.test(tag) ? 'h1, h2, h3, h4' : undefined;
    let segmentText = '';
    if (boundary) {
      const seg = node.nextUntil(boundary).clone();
      seg.find('script,style,nav,aside').remove();
      segmentText = cleanText(seg.text());
    }
    const nextText = cleanText(node.next().text());
    const candidate = segmentText || nextText;
    return candidate;
  }
  $(selector)
    .slice(0, maxItems)
    .each((_, el) => {
      const node = $(el);
      const title = node.text().trim();
      if (!title) return;
      if (
        !passesTextFilters(title, {
          include: source.parse.include_title_regex as string | undefined,
          exclude: source.parse.exclude_title_regex as string | undefined,
        })
      ) {
        return;
      }
      const anchor = node.find(linkSelector).first().length ? node.find(linkSelector).first() : node.closest('a');
      const href = anchor.attr('href') || node.find('a').first().attr('href') || baseUrl;
      const canonicalUrl = new URL(href, baseUrl).toString();
      const contextText = `${node.text()} ${node.next().text()} ${node.parent().text().slice(0, 240)}`;
      if (
        !passesTextFilters(contextText, {
          include: source.parse.include_context_regex as string | undefined,
          exclude: source.parse.exclude_context_regex as string | undefined,
        })
      ) {
        return;
      }
      const dateMatch = dateRegex ? contextText.match(dateRegex) : null;
      const published = safeIsoDate(dateMatch?.[0]);
      const summaryText = extractLocalSummary(node);
      items.push({
        source_id: source.source_id,
        platform: source.platform,
        surface: source.surface,
        title,
        canonical_url: canonicalUrl,
        published_at: published,
        summary: summaryText || cleanText(node.parent().text()),
        raw_excerpt: cleanText(`${title} ${summaryText || node.next().text()}`),
      });
    });

  return items;
}
