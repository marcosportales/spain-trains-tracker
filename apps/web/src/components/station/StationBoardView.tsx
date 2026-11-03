'use client';

import type { StationBoard } from '@stt/contracts';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { fetchStationBoard } from '@/lib/station-board-api';
import { serviceTypeVar } from '@/theme/tokens';
import { DelayBadge } from '../delay/DelayBadge';
import { runDetailPath } from '../run/run-detail-view';
import { ShareButton } from '../share/ShareButton';
import { Button } from '../ui/Button';
import { DetailSurface } from '../ui/DetailSurface';
import { entryBand, entryTimes } from './station-board-view';

export const REFRESH_MS = 30_000;

type Tab = 'departures' | 'arrivals';

/** Station board with departures/arrivals tabs, refreshed every 30 s from the API. */
export function StationBoardView({ initial }: { initial: StationBoard }) {
  const t = useTranslations('StationBoard');
  const router = useRouter();
  const [board, setBoard] = useState(initial);
  const [tab, setTab] = useState<Tab>('departures');
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const next = await fetchStationBoard(initial.stationCode);
        if (next) setBoard(next);
        setStale(!next);
      } catch {
        setStale(true);
      }
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [initial.stationCode]);

  const entries = board[tab];

  return (
    <DetailSurface
      label={t('label', { station: board.stationName })}
      actions={
        <>
          <ShareButton title={t('title', { station: board.stationName })} />
          <Button
            variant="ghost"
            icon={X}
            aria-label={t('close')}
            onClick={() => router.push('/')}
          />
        </>
      }
      headline={
        <div>
          <h1 className="text-[20px] leading-tight font-semibold md:text-[22px]">
            {board.stationName}
          </h1>
          <p className="mt-1 text-sm font-normal text-ink-2">{t('window')}</p>
        </div>
      }
    >
      {stale && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {t('stale')}
        </p>
      )}

      <div role="tablist" aria-label={t('tabs')} className="flex gap-2">
        {(['departures', 'arrivals'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`tab-${name}`}
            aria-selected={tab === name}
            aria-controls="board-panel"
            onClick={() => setTab(name)}
            className={`min-h-11 flex-1 rounded border px-3 text-sm font-medium ${tab === name ? 'bg-gray-900 text-white' : 'bg-white'}`}
          >
            {t(name)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="board-panel" aria-labelledby={`tab-${tab}`} className="mt-3">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-600">{t('empty')}</p>
        ) : (
          <ul className="divide-y rounded border bg-white">
            {entries.map((entry) => {
              const band = entryBand(entry);
              const times = entryTimes(entry);
              return (
                <li key={`${entry.serviceDate}/${entry.trainNumber}`}>
                  <Link
                    href={runDetailPath(entry)}
                    className="flex min-h-14 items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          aria-hidden="true"
                          className="inline-block size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: serviceTypeVar(entry.serviceType) }}
                        />
                        {entry.trainNumber}
                        {entry.lineCode && (
                          <span className="text-sm font-normal">· {entry.lineCode}</span>
                        )}
                      </span>
                      <span className="block truncate text-sm text-gray-600">
                        {t(tab === 'departures' ? 'to' : 'from', {
                          station: entry.counterpartStationCode,
                        })}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block tabular-nums">
                        {times.changed ? (
                          <>
                            <s className="text-gray-500">{times.scheduled}</s> {times.estimated}
                          </>
                        ) : (
                          times.scheduled
                        )}
                      </span>
                      <DelayBadge
                        band={band}
                        delaySeconds={entry.delaySeconds}
                        size="sm"
                        data-testid="delay-badge"
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DetailSurface>
  );
}
