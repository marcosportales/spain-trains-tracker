import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ReplayMap } from '@/components/replay/ReplayMap';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Replay' });
  return { title: t('title'), description: t('description') };
}

export default async function ReplayPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Replay' });
  return (
    <>
      <h1 className="sr-only">{t('title')}</h1>
      <ReplayMap label={t('mapLabel')} />
    </>
  );
}
