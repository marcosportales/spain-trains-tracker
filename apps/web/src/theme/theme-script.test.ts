import { describe, expect, it } from 'vitest';
import { THEME_SCRIPT } from './theme-script';

/** Runs the inline script against a fake `window`, `localStorage` and `document`. */
function run(stored: string | 'throw' | null, systemDark: boolean): string | null {
  let attribute: string | null = null;
  const fake = {
    localStorage: {
      getItem: () => {
        if (stored === 'throw') throw new Error('blocked');
        return stored;
      },
    },
    window: { matchMedia: () => ({ matches: systemDark }) },
    document: { documentElement: { setAttribute: (_: string, v: string) => (attribute = v) } },
  };
  new Function('localStorage', 'window', 'document', THEME_SCRIPT)(
    fake.localStorage,
    fake.window,
    fake.document,
  );
  return attribute;
}

describe('THEME_SCRIPT', () => {
  it('follows the OS when nothing is stored', () => {
    expect(run(null, true)).toBe('dark');
    expect(run(null, false)).toBe('light');
  });

  it('honours a stored choice over the OS', () => {
    expect(run('light', true)).toBe('light');
    expect(run('dark', false)).toBe('dark');
  });

  it('ignores garbage and survives a throwing storage', () => {
    expect(run('garbage', true)).toBe('dark');
    expect(run('throw', true)).toBe('dark');
  });
});
