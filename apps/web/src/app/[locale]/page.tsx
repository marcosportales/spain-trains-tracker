import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Suspense, use } from 'react';
import { TrainMap } from '@/components/map/TrainMap';

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations('Home');
  return (
    <>
      <h1 className="sr-only">{t('title')}</h1>
      <Suspense>
        <TrainMap label={t('mapLabel')} stationsHint={t('stationsHint')} />
      </Suspense>
    </>
  );
}
