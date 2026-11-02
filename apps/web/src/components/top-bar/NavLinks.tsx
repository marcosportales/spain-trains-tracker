'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { currentNavItem, NAV_ITEMS } from './nav-items';

/** Mapa · Puntualidad · Reproducción, with `aria-current="page"` on the current one. */
export function NavLinks({
  vertical = false,
  onNavigate,
}: {
  vertical?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations('Header');
  const current = currentNavItem(usePathname());
  return (
    <nav aria-label={t('navigation')}>
      <ul className={`flex gap-1 ${vertical ? 'flex-col' : 'items-center'}`}>
        {NAV_ITEMS.map(({ key, href }) => (
          <li key={key}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={key === current ? 'page' : undefined}
              className={`flex min-h-10 items-center rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                key === current ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:bg-surface-2'
              }`}
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
