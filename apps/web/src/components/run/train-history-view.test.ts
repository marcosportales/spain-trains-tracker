import type { TrainHistory } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  BAR_FLOOR_PX,
  BAR_MAX_PX,
  formatServiceDate,
  historyBars,
  recentRuns,
  typicalDelay,
} from './train-history-view';

const history = (over: Partial<TrainHistory> = {}): TrainHistory => ({
  trainNumber: '03063',
  days: 30,
  summary: { runs: 5, typicalSeconds: 420, onTimePct: 40 },
  runs: [
    { serviceDate: '2026-10-31', observations: 3, avgSeconds: 600, maxSeconds: 900 },
    { serviceDate: '2026-10-30', observations: 2, avgSeconds: -120, maxSeconds: 0 },
  ],
  ...over,
});

describe('typicalDelay', () => {
  it('is late with whole minutes', () =>
    expect(typicalDelay(history())).toEqual({ kind: 'late', runs: 5, minutes: 7 }));
  it('is on time under 5 min, early included', () => {
    for (const typicalSeconds of [-400, 0, 250])
      expect(
        typicalDelay(history({ summary: { runs: 5, typicalSeconds, onTimePct: 100 } })),
      ).toEqual({ kind: 'on_time', runs: 5 });
  });
  it('is late from 5 min', () =>
    expect(
      typicalDelay(history({ summary: { runs: 5, typicalSeconds: 300, onTimePct: 50 } })),
    ).toEqual({ kind: 'late', runs: 5, minutes: 5 }));
  it('is undefined without data', () => {
    const { summary: _, ...rest } = history();
    expect(typicalDelay(rest)).toBeUndefined();
  });
});

describe('recentRuns', () => {
  it('rounds to minutes, keeps newest first and caps the list', () => {
    expect(recentRuns(history())).toEqual([
      { serviceDate: '2026-10-31', minutes: 10, maxMinutes: 15 },
      { serviceDate: '2026-10-30', minutes: -2, maxMinutes: 0 },
    ]);
    expect(recentRuns(history(), 1)).toHaveLength(1);
  });
});

describe('historyBars', () => {
  const run = (serviceDate: string, avgSeconds: number, maxSeconds = avgSeconds) => ({
    serviceDate,
    observations: 2,
    avgSeconds,
    maxSeconds,
  });

  it('orders the Runs oldest first, so the newest ends on the right', () => {
    const bars = historyBars(history({ runs: [run('2026-10-31', 600), run('2026-10-30', 0)] }));
    expect(bars.map((b) => b.serviceDate)).toEqual(['2026-10-30', '2026-10-31']);
  });

  it('colours each bar by the Delay band of its average', () => {
    const bars = historyBars(
      history({ runs: [run('d3', 1000), run('d2', 400), run('d1', 60), run('d0', -300)] }),
    );
    expect(bars.map((b) => b.band)).toEqual(['on_time', 'on_time', 'late', 'severely_late']);
  });

  it('scales heights to the worst Run, with a floor for on-time and early Runs', () => {
    const bars = historyBars(history({ runs: [run('d2', 1200), run('d1', 600), run('d0', -300)] }));
    expect(bars.map((b) => b.heightPx)).toEqual([BAR_FLOOR_PX, BAR_MAX_PX / 2, BAR_MAX_PX]);
  });

  it('keeps every bar at the floor when all Runs are on time', () => {
    const bars = historyBars(history({ runs: [run('d1', 0), run('d0', -120)] }));
    expect(bars.map((b) => b.heightPx)).toEqual([BAR_FLOOR_PX, BAR_FLOOR_PX]);
  });

  it('carries the minutes for the tooltip', () => {
    expect(historyBars(history({ runs: [run('d0', 600, 900)] }))[0]).toMatchObject({
      minutes: 10,
      maxMinutes: 15,
    });
  });
});

describe('formatServiceDate', () => {
  it('is a short day and month in the locale', () => {
    expect(formatServiceDate('2026-10-30', 'es')).toBe('30 oct');
    expect(formatServiceDate('2026-10-30', 'en')).toMatch(/30/);
  });
});
