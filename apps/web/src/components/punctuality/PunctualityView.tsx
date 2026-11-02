'use client';

import type { DelayByHour, PunctualityRanking } from '@stt/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { fetchDelayByHour, fetchPunctualityRanking } from '@/lib/punctuality-api';
import { delayMinutes } from '../delay/delay-band';
import { hourBars, type SortDirection, type SortKey, sortLines } from './punctuality-view';

const DAY_OPTIONS = [7, 30, 90] as const;

type Initial = { ranking: PunctualityRanking; byHour: DelayByHour };

/** Line ranking and delay-by-hour chart over a selectable window of days. */
export function PunctualityView({ initial }: { initial: Initial }) {
  const t = useTranslations('Punctuality');
  const tFooter = useTranslations('Footer');
  const [days, setDays] = useState<number>(initial.ranking.days);
  const [lineCode, setLineCode] = useState<string | undefined>(undefined);
  const [ranking, setRanking] = useState(initial.ranking);
  const [byHour, setByHour] = useState(initial.byHour);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'onTimePct',
    direction: 'asc',
  });
  const [failed, setFailed] = useState(false);

  // Refetch when the window or selected Line differs from what is shown.
  useEffect(() => {
    if (days === ranking.days && lineCode === byHour.lineCode) return;
    let cancelled = false;
    Promise.all([
      days === ranking.days ? ranking : fetchPunctualityRanking(days),
      fetchDelayByHour(lineCode === undefined ? { days } : { days, lineCode }),
    ])
      .then(([nextRanking, nextByHour]) => {
        if (cancelled) return;
        setRanking(nextRanking);
        setByHour(nextByHour);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [days, lineCode, ranking, byHour.lineCode]);

  const lines = sortLines(ranking.lines, sort.key, sort.direction);
  const bars = hourBars(byHour.hours);
  const selected = ranking.lines.find((line) => line.lineCode === lineCode);
  const toggleSort = (key: SortKey) =>
    setSort((s) => ({
      key,
      direction: s.key === key && s.direction === 'asc' ? 'desc' : 'asc',
    }));
  const columns: [SortKey, string][] = [
    ['lineCode', t('line')],
    ['onTimePct', t('onTime')],
    ['avgSeconds', t('avgDelay')],
    ['runs', t('runs')],
  ];

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-4 pt-below-bar pb-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="text-sm text-gray-600">{t('description')}</p>

      <fieldset className="mt-3 flex gap-2 border-0 p-0">
        <legend className="sr-only">{t('window')}</legend>
        {DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={days === option}
            onClick={() => setDays(option)}
            className={`min-h-11 flex-1 rounded border px-3 text-sm font-medium ${days === option ? 'bg-gray-900 text-white' : 'bg-white'}`}
          >
            {t('lastDays', { days: option })}
          </button>
        ))}
      </fieldset>
      {failed && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {t('error')}
        </p>
      )}

      <h2 className="mt-5 text-lg font-semibold">{t('ranking')}</h2>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">{t('empty')}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                {columns.map(([key, label]) => (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={
                      sort.key === key
                        ? sort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    className="py-1 pr-3"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(key)}
                      className="min-h-11 font-medium"
                    >
                      {label}
                    </button>
                  </th>
                ))}
                <th scope="col" className="py-1">
                  <span className="sr-only">{t('showHours')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={line.lineCode}
                  className={`border-b ${line.lineCode === lineCode ? 'bg-gray-100' : ''}`}
                >
                  <th scope="row" className="py-1 pr-3 font-medium" title={line.name}>
                    {line.lineCode}
                  </th>
                  <td className="py-1 pr-3 tabular-nums">{line.onTimePct.toFixed(1)}%</td>
                  <td className="py-1 pr-3 tabular-nums">
                    {t('minutes', { minutes: delayMinutes(line.avgSeconds) })}
                  </td>
                  <td className="py-1 pr-3 tabular-nums">{line.runs}</td>
                  <td className="py-1">
                    <button
                      type="button"
                      aria-pressed={line.lineCode === lineCode}
                      onClick={() =>
                        setLineCode(line.lineCode === lineCode ? undefined : line.lineCode)
                      }
                      className="min-h-11 rounded border px-2 text-xs"
                    >
                      {t('showHours')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-5 text-lg font-semibold">{t('byHour')}</h2>
      <p className="text-sm text-gray-600">
        {selected ? t('forLine', { line: selected.name }) : t('forAllLines')}
      </p>
      <ol aria-label={t('byHour')} className="mt-3 flex h-40 items-end gap-0.5 border-b">
        {bars.map((bar) => (
          <li
            key={bar.hour}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            title={
              bar.minutes === undefined
                ? t('noData', { hour: bar.label })
                : t('hourTitle', { hour: bar.label, minutes: bar.minutes })
            }
          >
            <div className="w-full rounded-t bg-red-400" style={{ height: `${bar.heightPct}%` }} />
            <span className="sr-only">
              {bar.minutes === undefined
                ? t('noData', { hour: bar.label })
                : t('hourTitle', { hour: bar.label, minutes: bar.minutes })}
            </span>
          </li>
        ))}
      </ol>
      <div aria-hidden className="mt-1 flex justify-between text-xs text-gray-600">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      <p className="mt-6 text-xs text-ink-3">{tFooter('attribution')}</p>
    </div>
  );
}
