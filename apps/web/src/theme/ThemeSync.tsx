'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';
import { applyTheme } from './use-theme';

/**
 * Switching locale re-renders `<html lang>` from the layout, which drops the `data-theme`
 * attribute that was set straight on the DOM. Put it back after every locale change.
 */
export function ThemeSync() {
  const locale = useLocale();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `locale` is the trigger, not a value read
  useEffect(applyTheme, [locale]);
  return null;
}
