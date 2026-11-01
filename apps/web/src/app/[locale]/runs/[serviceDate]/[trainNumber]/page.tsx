import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { TrainMap } from '@/components/map/TrainMap';
import { RunDetailPanel } from '@/components/run/RunDetailPanel';
import { badgeText, runOgContent } from '@/components/share/og-content';
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
  const content = runOgContent(detail);
  const badge = badgeText(content.badge, content.delayMinutes, {
    on_time: t('badge.on_time'),
    cancelled: t('badge.cancelled'),
    unknown: t('badge.unknown'),
    late: (minutes) => t('badge.late', { minutes }),
  });
  const title = t('title', { trainNumber: detail.run.trainNumber });
  const description = t('description', {
    serviceType: t(`serviceTypes.${content.serviceType}`),
    trainNumber: content.trainNumber,
    status: badge,
  });
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image' },
  };
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
          stationsHint={t('stationsHint')}
          selected={{ serviceDate: detail.run.serviceDate, trainNumber: detail.run.trainNumber }}
          selectedFallback={detail.run}
        />
      </Suspense>
      <RunDetailPanel detail={detail} />
    </>
  );
}
