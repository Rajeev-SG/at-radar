import { expect, test } from '@playwright/test';

test('timeline loads and API feeds work', async ({ page, request }) => {
  const isCI = !!process.env.CI;
  const apiUrl = isCI ? 'https://adtech-change-radar-api.rajeev-sgill.workers.dev' : 'http://127.0.0.1:8787';

  // Test main page loads
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  
  // Wait for events to load (either cards appear or "no events" message)
  await page.waitForSelector('.radar-card', { timeout: 10000 });

  // Test RSS feed
  const rssRes = await request.get(`${apiUrl}/api/feeds/rss`);
  expect(rssRes.ok()).toBeTruthy();
  expect(await rssRes.text()).toContain('<rss');

  // Test JSON feed  
  const jsonRes = await request.get(`${apiUrl}/api/feeds/json`);
  expect(jsonRes.ok()).toBeTruthy();
  const jsonFeed = await jsonRes.json();
  expect(jsonFeed.items).toBeDefined();

  // Test pagination via API
  const page1 = await request.get(`${apiUrl}/api/events?limit=5`).then((r) => r.json() as any);
  expect(page1.items.length).toBe(5);
  expect(page1.next_cursor).toBeTruthy();
  const page2 = await request.get(`${apiUrl}/api/events?limit=5&cursor=${encodeURIComponent(page1.next_cursor)}`).then((r) => r.json() as any);
  expect(page2.items.length).toBeGreaterThan(0);
  
  // Test event detail with enriched content
  if (page1.items[0]?.event_id) {
    const detail = await request.get(`${apiUrl}/api/events/${page1.items[0].event_id}`).then((r) => r.json() as any);
    expect(detail.event_id).toBe(page1.items[0].event_id);
    // enriched_article field exists (may be null or contain data)
    expect(detail).toHaveProperty('enriched_article');
  }
});
