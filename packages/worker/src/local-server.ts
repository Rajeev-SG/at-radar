import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import Database from 'better-sqlite3';
import { handleApiRequest } from './api/routes';
import { runIngestion } from './ingest/engine';
import { FixtureHttpClient } from './ingest/http';
import { getConfigBundle } from './ingest/config';
import type { D1Like, PreparedLike } from './types';

class BetterPrepared implements PreparedLike {
  constructor(private readonly stmt: Database.Statement, private readonly bound: unknown[] = []) {}
  bind(...values: unknown[]): PreparedLike { return new BetterPrepared(this.stmt, values); }
  async first<T>(): Promise<T | null> { return (this.stmt.get(...this.bound) as T) ?? null; }
  async all<T>(): Promise<{ results: T[] }> { return { results: this.stmt.all(...this.bound) as T[] }; }
  async run(): Promise<{ success: boolean; changes?: number }> { const r = this.stmt.run(...this.bound); return { success: true, changes: Number(r.changes) }; }
}
class BetterSqliteD1 implements D1Like {
  constructor(public readonly db: Database.Database) {}
  prepare(sql: string): PreparedLike { return new BetterPrepared(this.db.prepare(sql)); }
}

function applyMigrations(db: Database.Database) {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

function readFixture(...parts: string[]) {
  return fs.readFileSync(path.resolve(process.cwd(), 'fixtures', ...parts), 'utf8');
}

function fixtureMap() {
  return {
    'https://developers.google.com/google-ads/api/docs/release-notes': { bodyText: readFixture('html', 'google_ads_api.html') },
    'https://ads-developers.googleblog.com/feeds/posts/default': { bodyText: readFixture('rss', 'google_ads_blog.xml') },
    'https://developers.facebook.com/docs/marketing-api/marketing-api-changelog/': { bodyText: readFixture('html', 'meta_marketing_api.html') },
    'https://developers.facebook.com/docs/graph-api/changelog/': { bodyText: readFixture('html', 'meta_graph_api.html') },
    'https://developers.tiktok.com/doc/changelog': { bodyText: readFixture('html', 'tiktok_changelog.html') },
    'https://advertising.amazon.com/API/docs/en-us/release-notes/ads-api': { bodyText: readFixture('html', 'amazon_ads_release_notes.html') },
    'https://advertising.amazon.com/API/docs/en-us/release-notes/deprecations': { bodyText: readFixture('html', 'amazon_ads_deprecations.html') },
    'https://developers.google.com/google-ads/api/docs/start': { bodyText: readFixture('html', 'docs_monitor_google.html') },
    'https://developers.google.com/google-ads/api/docs/oauth/overview': { bodyText: readFixture('html', 'docs_monitor_google_auth.html') },
    'https://developers.google.com/google-ads/api/docs/client-libs': { bodyText: readFixture('html', 'docs_monitor_google_client_libs.html') },
  };
}

async function bootstrap() {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  applyMigrations(raw);
  const DB = new BetterSqliteD1(raw);
  const env = { DB, APP_VERSION: 'local', RADAR_ADMIN_TOKEN: 'local-dev-token' } as any;
  await runIngestion(env, { config: getConfigBundle(), httpClient: new FixtureHttpClient(fixtureMap() as any), triggerType: 'local-bootstrap' });

  const server = http.createServer(async (req, res) => {
    const bodyChunks: Buffer[] = [];
    req.on('data', (chunk) => bodyChunks.push(Buffer.from(chunk)));
    req.on('end', async () => {
      const request = new Request(`http://127.0.0.1:8787${req.url || '/'}`, {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : Buffer.concat(bodyChunks),
      });
      const response = await handleApiRequest(request, env);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      const buf = Buffer.from(await response.arrayBuffer());
      res.end(buf);
    });
  });

  server.listen(8787, '127.0.0.1', () => {
    console.log('Local worker API running at http://127.0.0.1:8787');
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
