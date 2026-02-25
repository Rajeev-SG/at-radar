import { describe, expect, it } from 'vitest';
import { getUiConfig } from './config';

describe('ui config loader', () => {
  it('loads config-driven pages', () => {
    const ui = getUiConfig();
    expect(ui.brand.title).toContain('AdTech');
    expect(ui.pages.length).toBeGreaterThan(3);
  });
});
