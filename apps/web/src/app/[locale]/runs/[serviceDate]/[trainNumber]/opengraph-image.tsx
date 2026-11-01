import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { badgeText, OG_SIZE, runOgContent } from '@/components/share/og-content';
import { runOgImage } from '@/components/share/og-image';
import { fetchRunDetail } from '@/lib/run-detail-api';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Spain Trains Tracker';

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; serviceDate: string; trainNumber: string }>;
}) {
  const { locale, serviceDate, trainNumber } = await params;
  const detail = await fetchRunDetail({ serviceDate, trainNumber });
  if (!detail) notFound();
  const content = runOgContent(detail);
  const t = await getTranslations({ locale, namespace: 'RunDetail' });
  const header = await getTranslations({ locale, namespace: 'Header' });
  return runOgImage(content, {
    appName: header('appName'),
    serviceType: t(`serviceTypes.${content.serviceType}`),
    badge: badgeText(content.badge, content.delayMinutes, {
      on_time: t('badge.on_time'),
      cancelled: t('badge.cancelled'),
      unknown: t('badge.unknown'),
      late: (minutes) => t('badge.late', { minutes }),
    }),
  });
}
