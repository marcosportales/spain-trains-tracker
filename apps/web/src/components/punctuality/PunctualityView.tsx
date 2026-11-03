'use client';

import type { DelayByHour, PunctualityRanking } from '@stt/contracts';
import { Info } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { fetchDelayByHour, fetchPunctualityRanking } from '@/lib/punctuality-api';
import { type DelayBand, delayMinutes } from '../delay/delay-band';
import { Popover } from '../ui/Popover';
import { SegmentedControl } from '../ui/SegmentedControl';
import { byHourSummary, hourBars, punctualityHeadline, rankingBars } from './punctuality-view';

const BAND_BAR: Partial<Record<DelayBand, string>> = {
  on_time: 'bg-band-on-time',
  late: 'bg-band-late',
  severely_late: 'bg-band-severely-late',
};

const DAY_OPTIONS = [7, 30, 90] as const;
type WindowDays = `${(typeof DAY_OPTIONS)[number]}`;

type Initial = { ranking: PunctualityRanking; byHour: DelayByHour };

/** Line ranking and delay-by-hour chart over a selectable window of days. */
export function PunctualityView({ initial }: { initial: Initial }) {
  const t = useTranslations('Punctuality');
  const locale = useLocale();
  const tFooter = useTranslations('Footer');
  const [days, setDays] = useState<number>(initial.ranking.days);
  const [lineCode, setLineCode] = useState<string | undefined>(undefined);
  const [ranking, setRanking] = useState(initial.ranking);
  const [byHour, setByHour] = useState(initial.byHour);
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

  const rows = rankingBars(ranking.lines);
  const headline = punctualityHeadline(ranking);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const bars = hourBars(byHour.hours);
  const summary = byHourSummary(byHour.hours);
  const selected = ranking.lines.find((line) => line.lineCode === lineCode);

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-4 pt-below-bar pb-4">
      <h1 className="text-2xl font-semibold md:text-3xl">
        {headline.kind === 'none'
          ? t('headlineNone', { days: ranking.days })
          : t('headline', { days: ranking.days, pct: percent.format(headline.pct) })}
      </h1>
      <p className="mt-1 flex items-center gap-1 text-sm text-ink-2">
        {t('onTimeExplainer')}
        <Popover
          trigger={
            <button
              type="button"
              aria-label={t('onTimeInfo')}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Info aria-hidden="true" size={18} />
            </button>
          }
        >
          <p className="max-w-xs text-sm">{t('onTimeDetail')}</p>
        </Popover>
      </p>

      <div className="mt-3">
        <SegmentedControl<WindowDays>
          aria-label={t('window')}
          value={String(days) as WindowDays}
          onChange={(value) => setDays(Number(value))}
          options={DAY_OPTIONS.map((option) => ({
            value: String(option) as WindowDays,
            label: t('windowDays', { days: option }),
          }))}
        />
      </div>
      {failed && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {t('error')}
        </p>
      )}

      <h2 className="mt-5 text-lg font-semibold">{t('ranking')}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">{t('empty')}</p>
      ) : (
        <ol aria-label={t('ranking')} className="mt-2 flex flex-col">
          {rows.map(({ line, widthPct, band }) => {
            const lineSummary = t('lineSummary', {
              line: line.lineCode,
              pct: percent.format(line.onTimePct / 100),
              minutes: delayMinutes(line.avgSeconds),
              count: line.runs,
            });
            return (
              <li key={line.lineCode}>
                <button
                  type="button"
                  aria-pressed={line.lineCode === lineCode}
                  title={lineSummary}
                  onClick={() =>
                    setLineCode(line.lineCode === lineCode ? undefined : line.lineCode)
                  }
                  className={`flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent ${
                    line.lineCode === lineCode ? 'bg-surface-2' : ''
                  }`}
                >
                  <span className="w-28 min-w-0 shrink-0 truncate sm:w-44">
                    <span className="font-semibold">{line.lineCode}</span>{' '}
                    <span className="text-ink-2">{line.name}</span>
                  </span>
                  <span aria-hidden className="h-3 flex-1 rounded-full bg-surface-3">
                    <span
                      className={`block h-full rounded-full ${BAND_BAR[band] ?? 'bg-band-unknown'}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </span>
                  <span aria-hidden className="w-12 shrink-0 text-right tabular-nums">
                    {percent.format(line.onTimePct / 100)}
                  </span>
                  <span className="sr-only">{lineSummary}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <h2 className="mt-5 text-lg font-semibold">{t('byHour')}</h2>
      <p className="text-sm text-gray-600">
        {selected ? t('forLine', { line: selected.name }) : t('forAllLines')}
      </p>
      <p className="mt-2 text-sm">
        {summary.kind === 'none'
          ? t('byHourNone')
          : summary.kind === 'calm'
            ? t('byHourCalm')
            : t('byHourPeak', { from: summary.from, to: summary.to })}
      </p>
      <ol
        aria-label={t('byHour')}
        className="mt-3 flex h-40 items-end gap-0.5 border-b border-surface-3"
      >
        {bars.map((bar) => {
          const label =
            bar.minutes === undefined
              ? t('noData', { hour: bar.label })
              : t('hourTitle', { hour: bar.label, minutes: bar.minutes, count: bar.count });
          return (
            <li
              key={bar.hour}
              className="flex h-full min-w-0 flex-1 flex-col justify-end"
              title={label}
            >
              {bar.minutes !== undefined && (
                <div
                  className={`w-full rounded-t ${BAND_BAR[bar.band] ?? 'bg-band-unknown'}`}
                  style={{ height: `${bar.heightPct}%` }}
                />
              )}
              <span className="sr-only">{label}</span>
            </li>
          );
        })}
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
