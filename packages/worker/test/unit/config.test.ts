import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAndValidateConfigBundle } from '../../src/ingest/validate';

describe('config validation', () => {
  it('loads and validates all config files', () => {
    const bundle = loadAndValidateConfigBundle(path.resolve(process.cwd(), '../../config'));
    expect(bundle.sources.length).toBeGreaterThanOrEqual(8);
    expect(bundle.ui.pages.some((p) => p.id === 'timeline')).toBe(true);
  });
});
