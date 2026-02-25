import type { ConfigBundle, D1Like, RunSummary, SourceConfig } from '../types';
import { getConfigBundle } from './config';
import { FetchApiHttpClient, type HttpClient, robotsAllowed } from './http';
import { parseRss } from './strategies/rss';
import { parseHtmlList } from './strategies/html_list';
import { parseHtmlFingerprint } from './strategies/html_fingerprint';
import { parseJsonFeed } from './strategies/json_feed';
import { normalizeCandidate } from './normalize';
import { tagEvent } from './tagger';
import {
  cursorKey,
  finishFetchRun,
  getCursorState,
  insertFetchArtifact,
  persistSourceSnapshot,
  startFetchRun,
  upsertChangeEvent,
  upsertCursorState,
} from '../db/queries';
import { nowIso, sha256Hex } from '../util';

export interface IngestEnv {
  DB: D1Like;
  RADAR_ADMIN_TOKEN?: string;
  APP_VERSION?: string;
}

export interface IngestOptions {
  triggerType?: string;
  config?: ConfigBundle;
  httpClient?: HttpClient;
  sourceFilter?: string[];
}

function makeRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function parseCandidates(source: SourceConfig, bodyText: string, url: string, previousBody?: string | null, targetId?: string) {
  if (source.strategy === 'rss') return parseRss(source, bodyText);
  if (source.strategy === 'html_list') return parseHtmlList(source, bodyText, url);
  if (source.strategy === 'json_feed') return parseJsonFeed(source, bodyText);
  if (source.strategy === 'html_fingerprint') {
    const candidate = parseHtmlFingerprint(source, bodyText, url, previousBody, targetId);
    return candidate ? [candidate] : [];
  }
  return [];
}

async function ingestSourceTarget(
  db: D1Like,
  bundle: ConfigBundle,
  source: SourceConfig,
  runId: string,
  httpClient: HttpClient,
  target: { id?: string; url: string },
): Promise<number> {
  if (!(await robotsAllowed(target.url))) {
    return 0;
  }
  const cursor = await getCursorState(db, source.source_id, target.id);
  const reqHeaders: Record<string, string> = { ...(source.request.headers ?? {}) };
  if (cursor?.etag) reqHeaders['If-None-Match'] = cursor.etag;
  if (cursor?.last_modified) reqHeaders['If-Modified-Since'] = cursor.last_modified;
  const fetched = await httpClient.fetchText(target.url, { headers: reqHeaders });
  if (fetched.status === 304) return 0;

  const bodyHash = await sha256Hex(fetched.bodyText);
  if (source.cursor.type === 'content_hash' && cursor?.last_hash === bodyHash) {
    await upsertCursorState(db, {
      source_cursor_key: cursorKey(source.source_id, target.id),
      source_id: source.source_id,
      target_id: target.id ?? null,
      last_seen_published_at: cursor.last_seen_published_at ?? null,
      etag: fetched.headers.etag ?? cursor.etag ?? null,
      last_modified: fetched.headers['last-modified'] ?? cursor.last_modified ?? null,
      last_hash: bodyHash,
      last_body_text: cursor.last_body_text ?? null,
      updated_at: nowIso(),
    });
    return 0;
  }
  const artifactId = await sha256Hex(`${runId}|${source.source_id}|${target.id ?? ''}|${fetched.url}|${fetched.fetchedAt}`);
  const truncated = fetched.bodyText.length > 100_000;
  await insertFetchArtifact(db, {
    artifactId,
    runId,
    sourceId: source.source_id,
    targetId: target.id,
    requestUrl: fetched.url,
    statusCode: fetched.status,
    etag: fetched.headers.etag ?? null,
    lastModified: fetched.headers['last-modified'] ?? null,
    fetchedAt: fetched.fetchedAt,
    bodyHash,
    bodyText: truncated ? fetched.bodyText.slice(0, 100_000) : fetched.bodyText,
    truncated,
    headers: fetched.headers,
  });

  const candidates = await parseCandidates(source, fetched.bodyText, target.url, cursor?.last_body_text, target.id);
  let written = 0;
  let latestPublished = cursor?.last_seen_published_at ?? null;
  let latestContentText: string | null = null;

  for (const candidate of candidates.slice(0, source.rate_limit.max_items_per_run)) {
    if (candidate.content_text) latestContentText = candidate.content_text;
    const normalized = await normalizeCandidate(source, candidate, bundle.normalization, fetched.fetchedAt);
    const tagged = tagEvent({ ...normalized, artifact_id: artifactId }, bundle.taxonomy);
    await upsertChangeEvent(db, tagged);
    if (!latestPublished || tagged.published_at > latestPublished) latestPublished = tagged.published_at;
    written += 1;
  }

  await upsertCursorState(db, {
    source_cursor_key: cursorKey(source.source_id, target.id),
    source_id: source.source_id,
    target_id: target.id ?? null,
    last_seen_published_at: latestPublished,
    etag: fetched.headers.etag ?? null,
    last_modified: fetched.headers['last-modified'] ?? null,
    last_hash: bodyHash,
    last_body_text:
      source.strategy === 'html_fingerprint'
        ? (latestContentText ?? cursor?.last_body_text ?? null)?.slice(0, 20000) ?? null
        : cursor?.last_body_text ?? null,
    updated_at: nowIso(),
  });

  return written;
}

export async function runIngestion(env: IngestEnv, options: IngestOptions = {}): Promise<RunSummary> {
  const bundle = options.config ?? getConfigBundle();
  const httpClient = options.httpClient ?? new FetchApiHttpClient();
  const runId = makeRunId();
  const selectedSources = options.sourceFilter?.length
    ? bundle.sources.filter((s) => options.sourceFilter!.includes(s.source_id))
    : bundle.sources;

  await startFetchRun(env.DB, runId, options.triggerType ?? 'manual', selectedSources.length);

  const errors: Array<{ source_id: string; message: string }> = [];
  let totalEvents = 0;

  for (const source of selectedSources) {
    try {
      const configHash = await sha256Hex(JSON.stringify(source));
      await persistSourceSnapshot(env.DB, source, configHash);
      const targets = source.request.targets?.length ? source.request.targets : [{ url: source.request.url }];
      for (const target of targets) {
        totalEvents += await ingestSourceTarget(env.DB, bundle, source, runId, httpClient, { id: (target as any).id, url: target.url });
      }
    } catch (error) {
      errors.push({ source_id: source.source_id, message: error instanceof Error ? error.message : String(error) });
    }
  }

  const status = errors.length === 0 ? 'success' : totalEvents > 0 ? 'partial' : 'error';
  await finishFetchRun(env.DB, runId, status, totalEvents, errors);

  return {
    runId,
    totalSources: selectedSources.length,
    totalEvents,
    errorCount: errors.length,
    errors,
  };
}
