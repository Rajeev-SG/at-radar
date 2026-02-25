import type { D1Like } from '../types';
import { listEvents } from '../db/queries';

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function rssFeedResponse(db: D1Like, baseUrl: string) {
  const { items } = await listEvents(db, { limit: 50 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>AdTech Change Radar</title><link>${xmlEscape(baseUrl)}</link><description>Recent AdTech platform changes</description>${items
    .map(
      (item) => `<item><guid>${xmlEscape(item.event_id)}</guid><title>${xmlEscape(item.title)}</title><link>${xmlEscape(item.canonical_url)}</link><pubDate>${new Date(item.published_at).toUTCString()}</pubDate><description>${xmlEscape(item.summary)}</description></item>`,
    )
    .join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}

export async function jsonFeedResponse(db: D1Like, baseUrl: string) {
  const { items } = await listEvents(db, { limit: 50 });
  const body = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'AdTech Change Radar',
    home_page_url: baseUrl,
    feed_url: `${baseUrl}/api/feeds/json`,
    items: items.map((item) => ({
      id: item.event_id,
      url: item.canonical_url,
      title: item.title,
      content_text: item.summary,
      date_published: item.published_at,
      tags: item.labels ?? [],
    })),
  };
  return Response.json(body, { headers: { 'content-type': 'application/feed+json; charset=utf-8' } });
}
