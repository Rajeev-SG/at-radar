import type { CandidateEvent, ChangeEvent, EventType, NormalizationConfig, SourceConfig } from '../types';
import { cleanText, nowIso, safeIsoDate, sha256Hex, stripHtml, truncate } from '../util';

function inferEventType(candidate: CandidateEvent): EventType {
  const text = `${candidate.title} ${candidate.summary ?? ''}`.toLowerCase();
  if (candidate.event_type) return candidate.event_type;
  if (text.includes('deprecat') || text.includes('sunset') || text.includes('legacy')) return 'deprecation';
  if (text.includes('breaking')) return 'breaking_change';
  if (candidate.surface === 'docs') return 'docs_update';
  return 'release';
}

export async function normalizeCandidate(
  source: SourceConfig,
  candidate: CandidateEvent,
  normalization: NormalizationConfig,
  fetchedAt = nowIso(),
): Promise<ChangeEvent> {
  const rawSource = candidate.raw_excerpt ?? candidate.summary ?? candidate.content_text ?? candidate.title;
  const rawClean = cleanText(normalization.summary.strip_html ? stripHtml(rawSource) : rawSource);
  const summary = truncate(rawClean, normalization.summary.max_chars);
  const rawExcerpt = truncate(rawClean, normalization.raw_excerpt.max_chars);
  const published = safeIsoDate(candidate.published_at) ?? fetchedAt;
  const publishedAtInferred = !safeIsoDate(candidate.published_at);
  const fingerprintSeed = [candidate.title, candidate.canonical_url, rawExcerpt, candidate.content_text ?? ''].join('|');
  const fingerprint = await sha256Hex(fingerprintSeed);
  const eventType = inferEventType(candidate);
  const eventIdSeed = `${source.source_id}|${candidate.canonical_url}|${published}|${candidate.title}`;
  const eventId = await sha256Hex(eventIdSeed);

  return {
    event_id: eventId,
    source_id: source.source_id,
    platform: source.platform,
    surface: source.surface,
    event_type: eventType,
    published_at: published,
    published_at_inferred: publishedAtInferred,
    effective_at: candidate.effective_at ?? null,
    title: cleanText(candidate.title),
    canonical_url: candidate.canonical_url,
    summary,
    raw_excerpt: rawExcerpt,
    fingerprint,
    versions_affected: candidate.versions_affected,
    entities_affected: candidate.entities_affected,
    labels: [...new Set([...(source.tags ?? []), ...(candidate.labels ?? [])])],
    severity: normalization.severity_defaults[eventType] as ChangeEvent['severity'],
    diff: candidate.diff,
  };
}
