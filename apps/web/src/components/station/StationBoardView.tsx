'use client';

import type { StationBoard, StationList } from '@stt/contracts';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { fetchStationBoard } from '@/lib/station-board-api';
import { stationNames } from '@/lib/station-names';
import { formatMadridTime } from '../run/run-detail-view';
import { ShareButton } from '../share/ShareButton';
import { Button } from '../ui/Button';
import { DetailSurface } from '../ui/DetailSurface';
import { EmptyState } from '../ui/EmptyState';
import { BoardTable } from './BoardTable';
import { boardHeadline, type Tab, updatedAgo } from './station-board-view';

export const REFRESH_MS = 30_000;
const TICK_MS = 10_000;

/** Station board with departures/arrivals tabs, refreshed every 30 s from the API. */
export function StationBoardView({
  initial,
  stations,
}: {
  initial: StationBoard;
  /** All Stations, to name the other end of each Run (codes when empty). */
  stations: StationList;
}) {
  const names = useMemo(() => stationNames(stations), [stations]);
  const t = useTranslations('StationBoard');
  const router = useRouter();
  const [board, setBoard] = useState(initial);
  const [tab, setTab] = useState<Tab>('departures');
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [now, setNow] = useState(updatedAt);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchStationBoard(initial.stationCode);
      if (!next) {
        setFailed(true);
        return;
      }
      const at = Date.now();
      setBoard(next);
      setUpdatedAt(at);
      setNow(at);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [initial.stationCode]);

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const ago = updatedAgo(now, updatedAt);

  const entries = board[tab];
  const headline = boardHeadline(entries, tab, names);
  const headlineText =
    headline.kind === 'empty'
      ? t(tab === 'departures' ? 'headline.emptyDepartures' : 'headline.emptyArrivals')
      : t(tab === 'departures' ? 'headline.nextDepartures' : 'headline.nextArrivals', {
          time: headline.time,
          station: headline.station,
        }) + (headline.lateCount > 0 ? t('headline.late', { count: headline.lateCount }) : '');

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
          <p className="mt-1 text-sm font-normal tabular-nums text-ink-2">{headlineText}</p>
          {failed ? (
            <div
              role="status"
              className="mt-1 flex items-center gap-2 text-sm font-normal text-ink-2"
            >
              <span>
                {t('refreshFailed', { time: formatMadridTime(new Date(updatedAt).toISOString()) })}
              </span>
              <Button variant="secondary" size="sm" onClick={refresh}>
                {t('retry')}
              </Button>
            </div>
          ) : (
            <p className="mt-1 text-xs font-normal tabular-nums text-ink-3">
              {t('updated', { unit: ago.unit, value: ago.value })}
            </p>
          )}
        </div>
      }
    >
      <div
        role="tablist"
        aria-label={t('tabs')}
        className="inline-flex gap-0.5 rounded-md bg-surface-3 p-0.5"
      >
        {(['departures', 'arrivals'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`tab-${name}`}
            aria-selected={tab === name}
            aria-controls="board-panel"
            onClick={() => setTab(name)}
            className={`inline-flex min-h-9 items-center justify-center rounded-sm px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
              tab === name ? 'bg-surface text-ink shadow-1' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {t(name)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="board-panel" aria-labelledby={`tab-${tab}`} className="mt-3">
        {entries.length === 0 ? (
          <EmptyState message={headlineText} />
        ) : (
          <BoardTable entries={entries} tab={tab} names={names} />
        )}
      </div>
    </DetailSurface>
  );
}
