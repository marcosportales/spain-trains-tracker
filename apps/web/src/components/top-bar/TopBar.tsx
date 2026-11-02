'use client';

import { ArrowLeft, Menu, Search, TrainFront } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '../LocaleSwitcher';
import { SearchBox } from '../search/SearchBox';
import { ThemeToggle } from '../ThemeToggle';
import { Button } from '../ui/Button';
import { Popover } from '../ui/Popover';
import { NavLinks } from './NavLinks';

/**
 * The floating top bar. On mobile the search collapses to an icon that expands over the bar, and
 * the nav, language and theme move into a menu. One `SearchBox` serves both layouts.
 */
export function TopBar() {
  const t = useTranslations('Header');
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const search = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searching) return;
    search.current?.querySelector('input')?.focus();
    const collapse = (event: KeyboardEvent) => event.key === 'Escape' && setSearching(false);
    document.addEventListener('keydown', collapse);
    return () => document.removeEventListener('keydown', collapse);
  }, [searching]);

  return (
    <header className="fixed inset-x-2.5 top-2.5 z-40 flex h-12 items-center gap-2 rounded-lg bg-surface px-2 text-ink shadow-2 md:inset-x-3 md:top-3 md:h-[52px] md:gap-4 md:px-4">
      {searching && (
        <Button
          variant="ghost"
          icon={ArrowLeft}
          aria-label={t('closeSearch')}
          onClick={() => setSearching(false)}
          className="md:hidden"
        />
      )}
      <Link
        href="/"
        className={`flex shrink-0 items-center gap-2 px-1 font-semibold focus-visible:outline-2 focus-visible:outline-accent ${searching ? 'max-md:hidden' : ''}`}
      >
        <TrainFront aria-hidden="true" size={20} className="text-accent" />
        <span className="max-lg:sr-only">{t('appName')}</span>
      </Link>
      <div
        ref={search}
        className={`min-w-0 flex-1 justify-center md:flex ${searching ? 'flex' : 'max-md:hidden'}`}
      >
        <SearchBox />
      </div>
      {!searching && (
        <Button
          variant="ghost"
          icon={Search}
          aria-label={t('openSearch')}
          onClick={() => setSearching(true)}
          className="ml-auto md:hidden"
        />
      )}
      <div className="flex shrink-0 items-center gap-3 max-md:hidden">
        <NavLinks />
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      {!searching && (
        <div className="md:hidden">
          <Popover
            align="end"
            open={menuOpen}
            onOpenChange={setMenuOpen}
            trigger={<Button variant="ghost" icon={Menu} aria-label={t('menu')} />}
          >
            <div className="flex flex-col gap-3">
              <NavLinks vertical onNavigate={() => setMenuOpen(false)} />
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </Popover>
        </div>
      )}
    </header>
  );
}
