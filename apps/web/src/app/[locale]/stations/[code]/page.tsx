import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StationBoardView } from '@/components/station/StationBoardView';
import { fetchStationBoard } from '@/lib/station-board-api';

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
  return { title: t('title', { station: board.stationName }) };
}

export default async function StationPage({ params }: { params: Params }) {
  const { locale, board } = await loadBoard(params);
  setRequestLocale(locale);
  return <StationBoardView initial={board} />;
}
