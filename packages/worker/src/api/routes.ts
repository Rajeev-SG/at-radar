import { getEventById, listEvents, listPlatforms, listTags, listUnenrichedEvents } from '../db/queries';
import { jsonFeedResponse, rssFeedResponse } from './feeds';
import { healthResponse } from './health';
import type { D1Like } from '../types';
import type { IngestEnv } from '../ingest/engine';
import { runIngestion } from '../ingest/engine';
import { cacheArticle, generateArticleWithOpenRouter, OpenRouterApiError } from '../enrich/article';

function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

function notFound(): Response {
  return Response.json({ error: 'not_found' }, { status: 404 });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  headers.set('access-control-allow-headers', 'authorization,content-type');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

interface BatchEnrichRequest {
  limit?: number;
  batch_size?: number;
  batchSize?: number;
  max_attempts?: number;
  maxAttempts?: number;
  backoff_base_ms?: number;
  backoffBaseMs?: number;
  max_backoff_ms?: number;
  maxBackoffMs?: number;
}

interface BatchEnrichSummary {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ event_id: string; title: string; message: string }>;
}

function parseBearerToken(request: Request): string | null {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;
  return request.json<T>();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableEnrichmentError(error: unknown): error is OpenRouterApiError {
  if (error instanceof OpenRouterApiError) {
    return error.status === 429 || error.status >= 500;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /429|rate limit|too many requests|fetch failed|timed out/i.test(message);
}

async function generateArticleWithBackoff(
  event: Parameters<typeof generateArticleWithOpenRouter>[0],
  apiKey: string,
  options: { maxAttempts: number; backoffBaseMs: number; maxBackoffMs: number },
) {
  let attempt = 0;

  while (true) {
    try {
      return await generateArticleWithOpenRouter(event, apiKey);
    } catch (error) {
      attempt += 1;
      if (attempt >= options.maxAttempts || !isRetryableEnrichmentError(error)) {
        throw error;
      }

      const suggestedDelay = error instanceof OpenRouterApiError ? error.retryAfterMs : undefined;
      const exponentialDelay = Math.min(
        options.maxBackoffMs,
        options.backoffBaseMs * 2 ** (attempt - 1),
      );
      const jitterMs = Math.floor(Math.random() * 250);
      const delayMs = Math.min(
        options.maxBackoffMs,
        Math.max(suggestedDelay ?? 0, exponentialDelay) + jitterMs,
      );

      await sleep(delayMs);
    }
  }
}

async function handleBatchEnrichment(
  request: Request,
  env: IngestEnv & { DB: D1Like },
): Promise<Response> {
  const token = parseBearerToken(request);
  if (!env.RADAR_ADMIN_TOKEN || token !== env.RADAR_ADMIN_TOKEN) {
    return withCors(unauthorized());
  }
  if (!env.OPENROUTER_API_KEY) {
    return withCors(Response.json({ error: 'missing_openrouter_api_key' }, { status: 500 }));
  }

  const body = (await readJsonBody<BatchEnrichRequest>(request)) ?? {};
  const limitRaw = body.limit;
  const limit = limitRaw == null ? Number.POSITIVE_INFINITY : clampInteger(limitRaw, 25, 1, 5000);
  const batchSize = clampInteger(body.batch_size ?? body.batchSize, 5, 1, 20);
  const maxAttempts = clampInteger(body.max_attempts ?? body.maxAttempts, 5, 1, 10);
  const backoffBaseMs = clampInteger(body.backoff_base_ms ?? body.backoffBaseMs, 1000, 100, 30000);
  const maxBackoffMs = clampInteger(body.max_backoff_ms ?? body.maxBackoffMs, 30000, 500, 120000);

  const summary: BatchEnrichSummary = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  let remaining = limit;
  while (remaining > 0) {
    const currentBatchSize = Number.isFinite(remaining)
      ? Math.min(batchSize, remaining)
      : batchSize;
    const events = await listUnenrichedEvents(env.DB, currentBatchSize);
    if (events.length === 0) break;

    for (const event of events) {
      summary.processed += 1;
      try {
        const article = await generateArticleWithBackoff(
          {
            title: event.title,
            summary: event.summary,
            raw_excerpt: event.raw_excerpt,
            platform: event.platform,
            event_type: event.event_type,
            source_id: event.source_id,
          },
          env.OPENROUTER_API_KEY,
          { maxAttempts, backoffBaseMs, maxBackoffMs },
        );
        await cacheArticle(env.DB, event.event_id, article);
        summary.succeeded += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await cacheArticle(
          env.DB,
          event.event_id,
          {
            what_changed: '',
            so_what: '',
            why_it_matters: '',
            generated_at: new Date().toISOString(),
          },
          message,
        );
        summary.failed += 1;
        summary.errors.push({
          event_id: event.event_id,
          title: event.title,
          message,
        });
      }
    }

    if (Number.isFinite(remaining)) {
      remaining -= events.length;
    }
    if (events.length < currentBatchSize) break;
  }

  return withCors(Response.json(summary));
}

export async function handleApiRequest(request: Request, env: IngestEnv & { DB: D1Like }): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }));
  }

  if (path === '/api/health' && request.method === 'GET') {
    return withCors(await healthResponse(env.DB, env.APP_VERSION ?? 'dev'));
  }

  if (path === '/api/events' && request.method === 'GET') {
    const data = await listEvents(env.DB, {
      platform: url.searchParams.get('platform') ?? undefined,
      tag: url.searchParams.get('tag') ?? undefined,
      event_type: url.searchParams.get('event_type') ?? undefined,
      severity: url.searchParams.get('severity') ?? undefined,
      since: url.searchParams.get('since') ?? undefined,
      until: url.searchParams.get('until') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      cursor: url.searchParams.get('cursor'),
    });
    return withCors(Response.json(data));
  }

  if (path.startsWith('/api/events/') && request.method === 'GET') {
    const id = decodeURIComponent(path.split('/').pop() ?? '');
    const data = await getEventById(env.DB, id);
    return withCors(data ? Response.json(data) : notFound());
  }

  if (path === '/api/platforms' && request.method === 'GET') {
    return withCors(Response.json({ items: await listPlatforms(env.DB) }));
  }

  if (path === '/api/tags' && request.method === 'GET') {
    return withCors(Response.json({ items: await listTags(env.DB) }));
  }

  if (path === '/api/feeds/rss' && request.method === 'GET') {
    return withCors(await rssFeedResponse(env.DB, `${url.origin}`));
  }

  if (path === '/api/feeds/json' && request.method === 'GET') {
    return withCors(await jsonFeedResponse(env.DB, `${url.origin}`));
  }

  if (path === '/api/admin/run' && request.method === 'POST') {
    const token = parseBearerToken(request);
    if (!env.RADAR_ADMIN_TOKEN || token !== env.RADAR_ADMIN_TOKEN) return withCors(unauthorized());
    const result = await runIngestion(env, { triggerType: 'manual' });
    return withCors(Response.json(result));
  }

  if (path === '/api/admin/enrich-all' && request.method === 'POST') {
    return handleBatchEnrichment(request, env);
  }

  return withCors(notFound());
}
