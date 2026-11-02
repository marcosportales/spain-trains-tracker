import type { TrainHistory } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import { recentRuns, typicalDelay } from './train-history-view';

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
