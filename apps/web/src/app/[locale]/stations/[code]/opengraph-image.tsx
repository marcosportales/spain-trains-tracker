import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { badgeText, OG_SIZE, stationOgContent } from '@/components/share/og-content';
import { stationOgImage } from '@/components/share/og-image';
import { fetchStationBoard } from '@/lib/station-board-api';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Spain Trains Tracker';

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  const board = await fetchStationBoard(code);
  if (!board) notFound();
  const content = stationOgContent(board);
  const t = await getTranslations({ locale, namespace: 'StationBoard' });
  const tb = await getTranslations({ locale, namespace: 'DelayBand' });
  const header = await getTranslations({ locale, namespace: 'Header' });
  const labels = {
    on_time: tb('on_time'),
    cancelled: tb('cancelled'),
    unknown: tb('unknown'),
    late: (minutes: number) => tb('late', { minutes }),
  };
  return stationOgImage(content, {
    appName: header('appName'),
    heading: `${t('departures')} · ${t('window')}`,
    empty: t('empty'),
    badges: content.departures.map((d) => badgeText(d.badge, d.delayMinutes, labels)),
  });
}
