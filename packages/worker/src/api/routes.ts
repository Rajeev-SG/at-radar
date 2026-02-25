import { getEventById, listEvents, listPlatforms, listTags } from '../db/queries';
import { jsonFeedResponse, rssFeedResponse } from './feeds';
import { healthResponse } from './health';
import type { D1Like } from '../types';
import type { IngestEnv } from '../ingest/engine';
import { runIngestion } from '../ingest/engine';

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
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!env.RADAR_ADMIN_TOKEN || token !== env.RADAR_ADMIN_TOKEN) return withCors(unauthorized());
    const result = await runIngestion(env, { triggerType: 'manual' });
    return withCors(Response.json(result));
  }

  return withCors(notFound());
}
