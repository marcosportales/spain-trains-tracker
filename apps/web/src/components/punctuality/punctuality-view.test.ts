import type { HourPunctuality, LinePunctuality } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import { hourBars, punctualityPath, sortLines } from './punctuality-view';

const line = (lineCode: string, onTimePct: number, avgSeconds = 0, runs = 100) =>
  ({
    lineCode,
    name: lineCode,
    serviceType: 'cercanias',
    onTimePct,
    avgSeconds,
    runs,
  }) satisfies LinePunctuality;

describe('sortLines', () => {
  const lines = [line('C2', 90, 30, 500), line('C1', 70, 400, 100), line('C3', 80, 100, 300)];
  const codes = (sorted: LinePunctuality[]) => sorted.map((l) => l.lineCode);

  it('puts the least punctual Line first by default', () =>
    expect(codes(sortLines(lines, 'onTimePct', 'asc'))).toEqual(['C1', 'C3', 'C2']));
  it('can put the most punctual first', () =>
    expect(codes(sortLines(lines, 'onTimePct', 'desc'))).toEqual(['C2', 'C3', 'C1']));
  it('sorts by average Delay', () =>
    expect(codes(sortLines(lines, 'avgSeconds', 'desc'))).toEqual(['C1', 'C3', 'C2']));
  it('sorts by Runs', () =>
    expect(codes(sortLines(lines, 'runs', 'desc'))).toEqual(['C2', 'C3', 'C1']));
  it('sorts by Line code', () =>
    expect(codes(sortLines(lines, 'lineCode', 'asc'))).toEqual(['C1', 'C2', 'C3']));
  it('does not mutate its input', () => {
    sortLines(lines, 'onTimePct', 'asc');
    expect(codes(lines)).toEqual(['C2', 'C1', 'C3']);
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
