'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { THEME_PREFERENCES, type ThemePreference } from '@/theme/theme';
import { useTheme } from '@/theme/use-theme';
import { SegmentedControl } from './ui/SegmentedControl';

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

/** Sistema / Claro / Oscuro. */
export function ThemeToggle() {
  const t = useTranslations('Theme');
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl<ThemePreference>
      aria-label={t('label')}
      value={preference}
      onChange={setPreference}
      options={THEME_PREFERENCES.map((value) => {
        const Icon = ICONS[value];
        return { value, label: <Icon aria-hidden="true" size={16} />, ariaLabel: t(value) };
      })}
    />
  );
}
