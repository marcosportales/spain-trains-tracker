import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations('Footer');
  return (
    <footer className="border-t px-4 py-3 text-sm text-neutral-600">{t('attribution')}</footer>
  );
}
