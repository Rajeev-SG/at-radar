import { describe, expect, it } from 'vitest';
import { buildUnifiedDiff } from '../../src/ingest/diff';

describe('buildUnifiedDiff', () => {
  it('emits a unified patch with both versions', () => {
    const patch = buildUnifiedDiff('hello world', 'hello radar');
    expect(patch).toContain('hello');
    expect(patch).toContain('radar');
  });
});
