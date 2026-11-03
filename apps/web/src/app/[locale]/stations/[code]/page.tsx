import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { TrainMap } from '@/components/map/TrainMap';
import { StationBoardView } from '@/components/station/StationBoardView';
import { fetchStationBoard } from '@/lib/station-board-api';
import { fetchStations } from '@/lib/stations-api';

type Params = Promise<{ locale: string; code: string }>;

async function loadBoard(params: Params) {
  const { locale, code } = await params;
  const board = await fetchStationBoard(code);
  if (!board) notFound();
  return { locale, board };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, board } = await loadBoard(params);
  const t = await getTranslations({ locale, namespace: 'StationBoard' });
  const title = t('title', { station: board.stationName });
  const description = t('description', { station: board.stationName });
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function StationPage({ params }: { params: Params }) {
  const { locale, board } = await loadBoard(params);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Home' });
  // Names are a nicety: if the Stations cannot be had, the board shows codes.
  const stations = await fetchStations({ revalidate: 3600 }).catch(() => []);
  return (
    <>
      <Suspense>
        <TrainMap
          label={t('mapLabel')}
          stationsHint={t('stationsHint')}
          focusStationCode={board.stationCode}
        />
      </Suspense>
      <StationBoardView initial={board} stations={stations} />
    </>
  );
}
