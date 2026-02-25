import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { D1Like, PreparedLike } from '../../src/types';

class BetterPrepared implements PreparedLike {
  constructor(private readonly stmt: Database.Statement, private readonly bound: unknown[] = []) {}

  bind(...values: unknown[]): PreparedLike {
    return new BetterPrepared(this.stmt, values);
  }

  async first<T>(): Promise<T | null> {
    const row = this.stmt.get(...this.bound);
    return (row as T) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const rows = this.stmt.all(...this.bound) as T[];
    return { results: rows };
  }

  async run(): Promise<{ success: boolean; changes?: number }> {
    const res = this.stmt.run(...this.bound);
    return { success: true, changes: Number(res.changes) };
  }
}

export class BetterSqliteD1 implements D1Like {
  constructor(public readonly db: Database.Database) {}

  prepare(sql: string): PreparedLike {
    return new BetterPrepared(this.db.prepare(sql));
  }
}

export function createTestDb(): BetterSqliteD1 {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return new BetterSqliteD1(db);
}

export function applyWorkerMigrations(sqlite: BetterSqliteD1): void {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    sqlite.db.exec(sql);
  }
}
