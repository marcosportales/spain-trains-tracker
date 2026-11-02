import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';
import { SearchBox } from './search/SearchBox';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  const t = useTranslations('Header');
  return (
    <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
      <Link href="/" className="shrink-0 font-semibold">
        {t('appName')}
      </Link>
      <Link href="/punctuality" className="shrink-0 text-sm">
        {t('punctuality')}
      </Link>
      <Link href="/replay" className="shrink-0 text-sm">
        {t('replay')}
      </Link>
      <SearchBox />
      <LocaleSwitcher />
      <ThemeToggle />
    </header>
  );
}
