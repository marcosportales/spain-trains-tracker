'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LocaleSwitcher() {
  const t = useTranslations('Header');
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('language')} className="flex gap-1">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          lang={locale}
          aria-current={locale === current ? 'true' : undefined}
          className={`flex min-h-10 items-center rounded-md px-2 text-sm focus-visible:outline-2 focus-visible:outline-accent ${
            locale === current ? 'font-bold text-ink' : 'text-ink-2 hover:bg-surface-2'
          }`}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
