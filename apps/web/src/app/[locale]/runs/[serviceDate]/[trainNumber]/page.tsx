import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { TrainMap } from '@/components/map/TrainMap';
import { RunDetailPanel } from '@/components/run/RunDetailPanel';
import { badgeText, runOgContent } from '@/components/share/og-content';
import { fetchRunDetail } from '@/lib/run-detail-api';
import { stationNames } from '@/lib/station-names';
import { fetchStations } from '@/lib/stations-api';
import { fetchTrainHistory } from '@/lib/train-history-api';

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
  const tb = await getTranslations({ locale, namespace: 'DelayBand' });
  const content = runOgContent(detail);
  const badge = badgeText(content.badge, content.delayMinutes, {
    on_time: tb('on_time'),
    cancelled: tb('cancelled'),
    unknown: tb('unknown'),
    late: (minutes) => tb('late', { minutes }),
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
  const [history, stations] = await Promise.all([
    fetchTrainHistory(detail.run.trainNumber),
    // Names are a nicety: if the Stations cannot be had, the panel shows codes.
    fetchStations({ revalidate: 3600 }).catch(() => []),
  ]);
  return (
    <>
      <Suspense>
        <TrainMap
          label={t('mapLabel')}
          stationsHint={t('stationsHint')}
          selected={{ serviceDate: detail.run.serviceDate, trainNumber: detail.run.trainNumber }}
          focusStationCode={detail.originStationCode}
          selectedFallback={
            detail.position && {
              ...detail.run,
              ...detail.position,
              ...(detail.delaySeconds !== undefined && { delaySeconds: detail.delaySeconds }),
            }
          }
        />
      </Suspense>
      <RunDetailPanel detail={detail} history={history} names={stationNames(stations)} />
    </>
  );
}
