import type { HourPunctuality, LinePunctuality, PunctualityRanking } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import { hourBars, punctualityHeadline, punctualityPath, rankingBars } from './punctuality-view';

const line = (lineCode: string, onTimePct: number, avgSeconds = 0, runs = 100) =>
  ({
    lineCode,
    name: lineCode,
    serviceType: 'cercanias',
    onTimePct,
    avgSeconds,
    runs,
  }) satisfies LinePunctuality;

describe('rankingBars', () => {
  it('orders worst to best, ties keeping the API order', () => {
    const bars = rankingBars([line('C2', 90), line('C1', 70), line('C4', 80), line('C3', 80)]);
    expect(bars.map((b) => b.line.lineCode)).toEqual(['C1', 'C4', 'C3', 'C2']);
  });
  it('sets the bar width to the on time share', () =>
    expect(rankingBars([line('C1', 87.4)])[0]?.widthPct).toBe(87.4));
  it('colours each bar by the band of the Line average Delay', () => {
    const bands = rankingBars([line('A', 90, 120), line('B', 90, 400), line('C', 90, 1000)]).map(
      (b) => b.band,
    );
    expect(bands).toEqual(['on_time', 'late', 'severely_late']);
  });
  it('does not mutate its input', () => {
    const lines = [line('C2', 90), line('C1', 70)];
    rankingBars(lines);
    expect(lines.map((l) => l.lineCode)).toEqual(['C2', 'C1']);
  });
});

describe('hourBars', () => {
  const hours = (avgs: (number | null)[]): HourPunctuality[] =>
    Array.from({ length: 24 }, (_, hour) => {
      const avg = avgs[hour] ?? null;
      return {
        hour,
        observations: avg === null ? 0 : 10,
        avgSeconds: avg,
        onTimePct: avg === null ? null : 80,
      };
    });

  it('scales bar heights to the worst hour', () => {
    const bars = hourBars(hours([null, 300, 600, 150]));
    expect(bars.map((b) => b.heightPct)).toEqual([0, 50, 100, 25, ...Array(20).fill(0)]);
  });
  it('shows early hours (negative Delay) as empty bars, not negative ones', () => {
    expect(hourBars(hours([-120, 60]))[0]?.heightPct).toBe(0);
  });
  it('is all zero when no hour has a positive average Delay', () => {
    expect(hourBars(hours([])).every((b) => b.heightPct === 0)).toBe(true);
  });
  it('rounds the average to whole minutes and labels the hour', () => {
    const bar = hourBars(hours([null, null, 90]))[2];
    expect(bar).toMatchObject({ hour: 2, minutes: 2, label: '02' });
    expect(hourBars(hours([]))[5]?.minutes).toBeUndefined();
  });
});

describe('punctualityPath', () => {
  it('is the page route', () => expect(punctualityPath).toBe('/punctuality'));
});

describe('punctualityHeadline', () => {
  const ranking = (overall: PunctualityRanking['overall']): PunctualityRanking => ({
    days: 7,
    overall,
    lines: [],
  });

  it('is the overall share of Runs as a 0-1 fraction', () =>
    expect(punctualityHeadline(ranking({ runs: 400, onTimePct: 60 }))).toEqual({
      kind: 'per_run',
      pct: 0.6,
    }));
  it('is none when no Line is ranked', () =>
    expect(punctualityHeadline(ranking(null))).toEqual({ kind: 'none' }));
});

describe('percent formatting', () => {
  const format = (locale: string) =>
    new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(0.87);

  it('uses a non-breaking space in es', () => expect(format('es')).toBe('87\u00a0%'));
  it('has no space in en', () => expect(format('en')).toBe('87%'));
});
