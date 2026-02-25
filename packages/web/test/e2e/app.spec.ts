import { expect, test } from '@playwright/test';

test('timeline filters, detail, pagination, and feeds', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.locator('#results .card')).toHaveCount(5);

  await page.selectOption('#event_type', 'deprecation');
  await page.click('#apply');
  const filteredCount = await page.locator('#results .card').count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThanOrEqual(5);

  const detailHref = await page.locator('#results .card .title a').first().getAttribute('href');
  expect(detailHref).toContain('/events?id=');
  await page.goto(detailHref!);
  await expect(page.getByRole('heading', { name: 'Event Detail' })).toBeVisible();
  await expect(page.locator('#detail')).toContainText('canonical source');

  const rssRes = await request.get('http://127.0.0.1:8787/api/feeds/rss');
  expect(rssRes.ok()).toBeTruthy();
  expect(await rssRes.text()).toContain('<rss');

  const page1 = await request.get('http://127.0.0.1:8787/api/events?limit=5').then((r) => r.json() as any);
  expect(page1.items.length).toBe(5);
  expect(page1.next_cursor).toBeTruthy();
  const page2 = await request.get(`http://127.0.0.1:8787/api/events?limit=5&cursor=${encodeURIComponent(page1.next_cursor)}`).then((r) => r.json() as any);
  expect(page2.items.length).toBeGreaterThan(0);
});
