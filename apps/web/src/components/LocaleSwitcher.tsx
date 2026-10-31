'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LocaleSwitcher() {
  const t = useTranslations('Header');
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('language')} className="flex gap-2">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          lang={locale}
          aria-current={locale === current ? 'true' : undefined}
          className={locale === current ? 'font-bold underline' : 'hover:underline'}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
