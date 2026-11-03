'use client';

import { X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '../ui/Button';

/** Closes Run detail: back to the map, keeping the current query string (the filters). */
export function RunCloseButton() {
  const t = useTranslations('RunDetail');
  const router = useRouter();
  const search = useSearchParams().toString();
  return (
    <Button
      variant="ghost"
      icon={X}
      aria-label={t('close')}
      onClick={() => router.push(search ? `/?${search}` : '/')}
    />
  );
}
