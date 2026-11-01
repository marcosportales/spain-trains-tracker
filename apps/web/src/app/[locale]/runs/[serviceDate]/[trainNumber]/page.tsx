import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { TrainMap } from '@/components/map/TrainMap';
import { RunDetailPanel } from '@/components/run/RunDetailPanel';
import { fetchRunDetail } from '@/lib/run-detail-api';

type Params = Promise<{ locale: string; serviceDate: string; trainNumber: string }>;

async function loadRun(params: Params) {
  const { locale, serviceDate, trainNumber } = await params;
  const detail = await fetchRunDetail({ serviceDate, trainNumber });
  if (!detail) notFound();
  return { locale, detail };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, detail } = await loadRun(params);
  const t = await getTranslations({ locale, namespace: 'RunDetail' });
  return { title: t('title', { trainNumber: detail.run.trainNumber }) };
}

export default async function RunPage({ params }: { params: Params }) {
  const { locale, detail } = await loadRun(params);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Home' });
  return (
    <>
      <Suspense>
        <TrainMap
          label={t('mapLabel')}
          selected={{ serviceDate: detail.run.serviceDate, trainNumber: detail.run.trainNumber }}
          selectedFallback={detail.run}
        />
      </Suspense>
      <RunDetailPanel detail={detail} />
    </>
  );
}
