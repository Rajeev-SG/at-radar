import fs from 'node:fs';
import path from 'node:path';

const baseDir = path.resolve(process.cwd(), 'fixtures');

export function readFixture(...parts: string[]): string {
  return fs.readFileSync(path.join(baseDir, ...parts), 'utf8');
}

export function readExpected(name: string): unknown {
  return JSON.parse(readFixture('expected', name));
}
