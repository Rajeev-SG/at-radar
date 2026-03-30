import type { ChangeEvent, D1Like, SourceConfig, SourceCursorState } from '../types';
import { decodeCursor, encodeCursor, nowIso } from '../util';

function json(value: unknown): string | null {
  return value == null ? null : JSON.stringify(value);
}

export async function dbPing(db: D1Like): Promise<boolean> {
  const row = await db.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return row?.ok === 1;
}

export async function persistSourceSnapshot(db: D1Like, source: SourceConfig, configHash: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sources (source_id, platform, surface, strategy, config_json, config_hash)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_id) DO UPDATE SET
         platform=excluded.platform,
         surface=excluded.surface,
         strategy=excluded.strategy,
         config_json=excluded.config_json,
         config_hash=excluded.config_hash,
         loaded_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .bind(source.source_id, source.platform, source.surface, source.strategy, JSON.stringify(source), configHash)
    .run();
}

export async function startFetchRun(db: D1Like, runId: string, triggerType: string, totalSources: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fetch_runs (run_id, trigger_type, started_at, status, total_sources)
       VALUES (?, ?, ?, 'running', ?)`,
    )
    .bind(runId, triggerType, nowIso(), totalSources)
    .run();
}

export async function finishFetchRun(
  db: D1Like,
  runId: string,
  status: 'success' | 'partial' | 'error',
  totalEvents: number,
  errors: Array<{ source_id: string; message: string }>,
): Promise<void> {
  await db
    .prepare(
      `UPDATE fetch_runs
         SET completed_at = ?, status = ?, total_events = ?, error_count = ?, error_json = ?
       WHERE run_id = ?`,
    )
    .bind(nowIso(), status, totalEvents, errors.length, JSON.stringify(errors), runId)
    .run();
}

export async function insertFetchArtifact(db: D1Like, artifact: {
  artifactId: string;
  runId: string;
  sourceId: string;
  targetId?: string;
  requestUrl: string;
  statusCode: number;
  etag?: string | null;
  lastModified?: string | null;
  fetchedAt: string;
  bodyHash: string;
  bodyText: string;
  truncated: boolean;
  headers: Record<string, string>;
}): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fetch_artifacts (
         artifact_id, run_id, source_id, target_id, request_url, status_code, etag, last_modified, fetched_at,
         body_hash, body_text, truncated, headers_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      artifact.artifactId,
      artifact.runId,
      artifact.sourceId,
      artifact.targetId ?? null,
      artifact.requestUrl,
      artifact.statusCode,
      artifact.etag ?? null,
      artifact.lastModified ?? null,
      artifact.fetchedAt,
      artifact.bodyHash,
      artifact.bodyText,
      artifact.truncated ? 1 : 0,
      JSON.stringify(artifact.headers),
    )
    .run();
}

export function cursorKey(sourceId: string, targetId?: string): string {
  return targetId ? `${sourceId}::${targetId}` : sourceId;
}

export async function getCursorState(db: D1Like, sourceId: string, targetId?: string): Promise<SourceCursorState | null> {
  return db
    .prepare(`SELECT * FROM cursor_state WHERE source_cursor_key = ?`)
    .bind(cursorKey(sourceId, targetId))
    .first<SourceCursorState>();
}

export async function upsertCursorState(db: D1Like, state: SourceCursorState): Promise<void> {
  await db
    .prepare(
      `INSERT INTO cursor_state (
         source_cursor_key, source_id, target_id, last_seen_published_at, etag, last_modified, last_hash, last_body_text, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_cursor_key) DO UPDATE SET
         last_seen_published_at=excluded.last_seen_published_at,
         etag=excluded.etag,
         last_modified=excluded.last_modified,
         last_hash=excluded.last_hash,
         last_body_text=excluded.last_body_text,
         updated_at=excluded.updated_at`,
    )
    .bind(
      state.source_cursor_key,
      state.source_id,
      state.target_id ?? null,
      state.last_seen_published_at ?? null,
      state.etag ?? null,
      state.last_modified ?? null,
      state.last_hash ?? null,
      state.last_body_text ?? null,
      state.updated_at ?? nowIso(),
    )
    .run();
}

export async function upsertChangeEvent(db: D1Like, event: ChangeEvent): Promise<void> {
  const existingByComposite = await db
    .prepare(
      `SELECT event_id
         FROM change_events
        WHERE source_id = ? AND canonical_url = ? AND published_at = ?
        LIMIT 1`,
    )
    .bind(event.source_id, event.canonical_url, event.published_at)
    .first<{ event_id: string }>();
  const persistedEventId = existingByComposite?.event_id ?? event.event_id;
  const storedEvent = persistedEventId === event.event_id ? event : { ...event, event_id: persistedEventId };

  await db
    .prepare(
      `INSERT INTO change_events (
        event_id, source_id, platform, surface, event_type, published_at, published_at_inferred,
        effective_at, title, canonical_url, summary, raw_excerpt, fingerprint,
        versions_affected_json, entities_affected_json, labels_json, severity, diff_json, artifact_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO UPDATE SET
        fingerprint=excluded.fingerprint,
        summary=excluded.summary,
        raw_excerpt=excluded.raw_excerpt,
        labels_json=excluded.labels_json,
        severity=excluded.severity,
        diff_json=excluded.diff_json,
        artifact_id=excluded.artifact_id,
        updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .bind(
      storedEvent.event_id,
      storedEvent.source_id,
      storedEvent.platform,
      storedEvent.surface,
      storedEvent.event_type,
      storedEvent.published_at,
      storedEvent.published_at_inferred ? 1 : 0,
      storedEvent.effective_at ?? null,
      storedEvent.title,
      storedEvent.canonical_url,
      storedEvent.summary,
      storedEvent.raw_excerpt,
      storedEvent.fingerprint,
      json(storedEvent.versions_affected),
      json(storedEvent.entities_affected),
      json(storedEvent.labels),
      storedEvent.severity ?? null,
      json(storedEvent.diff),
      storedEvent.artifact_id ?? null,
    )
    .run();

  await db.prepare(`DELETE FROM event_tags WHERE event_id = ?`).bind(storedEvent.event_id).run();
  for (const tag of storedEvent.labels ?? []) {
    await db.prepare(`INSERT OR IGNORE INTO event_tags (event_id, tag) VALUES (?, ?)`).bind(storedEvent.event_id, tag).run();
  }
}

export interface EventFilters {
  platform?: string;
  tag?: string;
  event_type?: string;
  severity?: string;
  since?: string;
  until?: string;
  q?: string;
  limit?: number;
  cursor?: string | null;
}

export async function listEvents(db: D1Like, filters: EventFilters) {
  const where: string[] = [];
  const values: unknown[] = [];
  let joinTags = false;

  if (filters.platform) {
    where.push('e.platform = ?');
    values.push(filters.platform);
  }
  if (filters.event_type) {
    where.push('e.event_type = ?');
    values.push(filters.event_type);
  }
  if (filters.severity) {
    where.push('e.severity = ?');
    values.push(filters.severity);
  }
  if (filters.since) {
    where.push('e.published_at >= ?');
    values.push(filters.since);
  }
  if (filters.until) {
    where.push('e.published_at <= ?');
    values.push(filters.until);
  }
  if (filters.q) {
    where.push('(e.title LIKE ? OR e.summary LIKE ? OR e.raw_excerpt LIKE ?)');
    const like = `%${filters.q}%`;
    values.push(like, like, like);
  }
  if (filters.tag) {
    joinTags = true;
    where.push('et.tag = ?');
    values.push(filters.tag);
  }

  const decoded = decodeCursor<{ published_at: string; event_id: string }>(filters.cursor ?? null);
  if (decoded) {
    where.push('(e.published_at < ? OR (e.published_at = ? AND e.event_id < ?))');
    values.push(decoded.published_at, decoded.published_at, decoded.event_id);
  }

  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const sql = `
    SELECT e.*
    FROM change_events e
    ${joinTags ? 'JOIN event_tags et ON et.event_id = e.event_id' : ''}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY e.published_at DESC, e.event_id DESC
    LIMIT ?
  `;
  const rows = (await db.prepare(sql).bind(...values, limit + 1).all<any>()).results;
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);

  const eventIds = pageRows.map((row) => row.event_id);
  const tagMap = new Map<string, string[]>();
  if (eventIds.length) {
    const placeholders = eventIds.map(() => '?').join(',');
    const tags = (await db.prepare(`SELECT event_id, tag FROM event_tags WHERE event_id IN (${placeholders})`).bind(...eventIds).all<any>())
      .results;
    for (const row of tags) {
      const arr = tagMap.get(row.event_id) ?? [];
      arr.push(row.tag);
      tagMap.set(row.event_id, arr);
    }
  }

  const items = pageRows.map((row) => ({
    ...row,
    published_at_inferred: Boolean(row.published_at_inferred),
    versions_affected: row.versions_affected_json ? JSON.parse(row.versions_affected_json) : [],
    entities_affected: row.entities_affected_json ? JSON.parse(row.entities_affected_json) : [],
    labels: tagMap.get(row.event_id) ?? (row.labels_json ? JSON.parse(row.labels_json) : []),
    diff: row.diff_json ? JSON.parse(row.diff_json) : null,
  }));

  return {
    items,
    next_cursor:
      hasMore && pageRows.length
        ? encodeCursor({
            published_at: pageRows[pageRows.length - 1].published_at,
            event_id: pageRows[pageRows.length - 1].event_id,
          })
        : null,
  };
}

export async function getEventById(db: D1Like, eventId: string) {
  const row = await db.prepare(`SELECT * FROM change_events WHERE event_id = ?`).bind(eventId).first<any>();
  if (!row) return null;
  const tags = (await db.prepare(`SELECT tag FROM event_tags WHERE event_id = ? ORDER BY tag`).bind(eventId).all<{ tag: string }>()).results;
  const artifact = row.artifact_id
    ? await db.prepare(`SELECT * FROM fetch_artifacts WHERE artifact_id = ?`).bind(row.artifact_id).first<any>()
    : null;
  const enriched = await db.prepare(`SELECT what_changed, so_what, why_it_matters, generated_at, model_used FROM enriched_articles WHERE event_id = ? AND error_message IS NULL`).bind(eventId).first<any>();
  return {
    ...row,
    published_at_inferred: Boolean(row.published_at_inferred),
    versions_affected: row.versions_affected_json ? JSON.parse(row.versions_affected_json) : [],
    entities_affected: row.entities_affected_json ? JSON.parse(row.entities_affected_json) : [],
    labels: tags.map((t) => t.tag),
    diff: row.diff_json ? JSON.parse(row.diff_json) : null,
    artifact: artifact
      ? {
          ...artifact,
          headers: artifact.headers_json ? JSON.parse(artifact.headers_json) : {},
        }
      : null,
    enriched_article: enriched ? {
      what_changed: enriched.what_changed,
      so_what: enriched.so_what,
      why_it_matters: enriched.why_it_matters,
      generated_at: enriched.generated_at,
      model_used: enriched.model_used,
    } : null,
  };
}

export async function listPlatforms(db: D1Like) {
  const rows = (await db.prepare(`SELECT platform, COUNT(*) AS count, MAX(published_at) AS latest FROM change_events GROUP BY platform ORDER BY latest DESC`).all<any>()).results;
  return rows;
}

export async function listTags(db: D1Like) {
  const rows = (await db.prepare(`SELECT tag, COUNT(*) AS count FROM event_tags GROUP BY tag ORDER BY count DESC, tag ASC`).all<any>()).results;
  return rows;
}
