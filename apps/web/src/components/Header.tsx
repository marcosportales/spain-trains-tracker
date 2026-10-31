import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';

export function Header() {
  const t = useTranslations('Header');
  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <Link href="/" className="font-semibold">
        {t('appName')}
      </Link>
      <LocaleSwitcher />
    </header>
  );
}
