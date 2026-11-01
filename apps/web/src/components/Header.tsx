import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';
import { SearchBox } from './search/SearchBox';

export function Header() {
  const t = useTranslations('Header');
  return (
    <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
      <Link href="/" className="shrink-0 font-semibold">
        {t('appName')}
      </Link>
      <SearchBox />
      <LocaleSwitcher />
    </header>
  );
}
