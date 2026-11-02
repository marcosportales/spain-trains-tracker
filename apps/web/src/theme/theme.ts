import type { Theme } from './tokens';

/** What the visitor chose; `system` follows the OS. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'stt-theme';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** The stored value if it is a known preference, otherwise `system`. */
export function parsePreference(raw: string | null): ThemePreference {
  return THEME_PREFERENCES.find((preference) => preference === raw) ?? 'system';
}
