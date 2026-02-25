import * as cheerio from 'cheerio';
import type { CandidateEvent, SourceConfig } from '../../types';
import { buildUnifiedDiff } from '../diff';
import { cleanText, regexFromConfig } from '../../util';

export function parseHtmlFingerprint(
  source: SourceConfig,
  bodyText: string,
  targetUrl: string,
  previousBodyText?: string | null,
  targetId?: string,
): CandidateEvent | null {
  const $ = cheerio.load(bodyText);
  const selector = String(source.parse.content_selector ?? 'main');
  const main = $(selector).first();
  if (!main.length) return null;
  for (const ignore of (source.parse.ignore_selectors as string[] | undefined) ?? []) {
    main.find(ignore).remove();
  }
  const contentText = cleanText(main.text());
  if (!contentText) return null;
  const rejectPatterns = (source.parse.reject_content_regex as string[] | undefined) ?? [];
  for (const pattern of rejectPatterns) {
    if (regexFromConfig(pattern).test(contentText)) return null;
  }
  if (/(\bwindow\.\w+|function\s*\(|requireLazy\(|ue_t0=ue_t0)/i.test(contentText)) return null;
  if (contentText.length < 40) return null;
  const title = targetId ? `Docs update: ${targetId}` : `Docs update: ${source.source_id}`;
  const diff = previousBodyText && previousBodyText !== contentText
    ? { format: 'unified', patch: buildUnifiedDiff(previousBodyText, contentText, targetId ?? source.source_id) }
    : undefined;

  return {
    source_id: source.source_id,
    platform: source.platform,
    surface: source.surface,
    event_type: 'docs_update',
    title,
    canonical_url: targetUrl,
    summary: contentText.slice(0, 240),
    raw_excerpt: contentText.slice(0, 280),
    content_text: contentText,
    target_id: targetId,
    diff,
  };
}
