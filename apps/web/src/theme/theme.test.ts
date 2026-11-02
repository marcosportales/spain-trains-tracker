import { describe, expect, it } from 'vitest';
import { parsePreference, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it.each([
    ['system', false, 'light'],
    ['system', true, 'dark'],
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
  ] as const)('%s with systemPrefersDark=%s is %s', (preference, systemDark, expected) => {
    expect(resolveTheme(preference, systemDark)).toBe(expected);
  });
});

describe('parsePreference', () => {
  it.each(['system', 'light', 'dark'] as const)('keeps %s', (value) => {
    expect(parsePreference(value)).toBe(value);
  });

  it.each([null, '', 'Dark', 'auto', '{}'])('falls back to system for %j', (raw) => {
    expect(parsePreference(raw)).toBe('system');
  });
});
