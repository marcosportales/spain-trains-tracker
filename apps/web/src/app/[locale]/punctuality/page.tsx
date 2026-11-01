import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PunctualityView } from '@/components/punctuality/PunctualityView';
import { fetchDelayByHour, fetchPunctualityRanking } from '@/lib/punctuality-api';

type Params = Promise<{ locale: string }>;
const DEFAULT_DAYS = 7;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Punctuality' });
  return { title: t('title'), description: t('description') };
}

export default async function PunctualityPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [ranking, byHour] = await Promise.all([
    fetchPunctualityRanking(DEFAULT_DAYS),
    fetchDelayByHour({ days: DEFAULT_DAYS }),
  ]);
  return <PunctualityView initial={{ ranking, byHour }} />;
}
