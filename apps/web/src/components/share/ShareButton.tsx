'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { browserShareEnv, type ShareOutcome, shareLink } from './share-link';

/** Shares the current page: native share sheet on mobile, copy-to-clipboard fallback on desktop. */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const t = useTranslations('Share');
  const [outcome, setOutcome] = useState<ShareOutcome>();

  async function onClick() {
    setOutcome(await shareLink(browserShareEnv(), { title, url: window.location.href }));
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={`min-h-11 rounded border px-3 text-sm font-medium ${className ?? ''}`}
      >
        {t('label')}
      </button>
      <span role="status" className="text-sm text-gray-600">
        {outcome === 'copied' && t('copied')}
        {outcome === 'failed' && t('failed')}
      </span>
    </>
  );
}
