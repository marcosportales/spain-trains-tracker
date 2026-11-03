'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { parsePreference, resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from './theme';
import type { Theme } from './tokens';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

const systemPrefersDark = (): boolean => window.matchMedia(DARK_QUERY).matches;

/** Puts the resolved theme on `<html>`. The inline script did it once before first paint. */
export function applyTheme() {
  document.documentElement.setAttribute(
    'data-theme',
    resolveTheme(readPreference(), systemPrefersDark()),
  );
}

function notify() {
  applyTheme();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', notify);
  window.addEventListener('storage', notify);
  return () => {
    listeners.delete(listener);
    query.removeEventListener('change', notify);
    window.removeEventListener('storage', notify);
  };
}

/** The visitor's preference, the theme it resolves to, and a setter that persists the choice. */
export function useTheme(): {
  preference: ThemePreference;
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
} {
  // Server snapshots match what the server renders; React corrects them right after hydration.
  const preference = useSyncExternalStore(subscribe, readPreference, () => 'system' as const);
  const systemDark = useSyncExternalStore(subscribe, systemPrefersDark, () => false);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage is unavailable: the choice still applies for this page view.
    }
    notify();
  }, []);

  return { preference, theme: resolveTheme(preference, systemDark), setPreference };
}
