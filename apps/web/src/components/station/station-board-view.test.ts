import type { StationBoardEntry } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import { entryBadge, entryTimes, stationBoardPath } from './station-board-view';

const entry = (over: Partial<StationBoardEntry> = {}): StationBoardEntry => ({
  trainNumber: '03063',
  serviceDate: '2026-10-31',
  serviceType: 'ave',
  counterpartStationCode: '71801',
  scheduledAt: '2026-10-31T09:00:00Z',
  ...over,
});

describe('entryBadge', () => {
  it.each([
    [{ serviceStatus: 'cancelled', delaySeconds: 0 }, 'cancelled'],
    [{}, 'unknown'],
    [{ delaySeconds: 30 }, 'on_time'],
    [{ delaySeconds: 120 }, 'minor'],
    [{ delaySeconds: 300 }, 'major'],
  ] as const)('%j is %s', (over, expected) => {
    expect(entryBadge(entry(over))).toBe(expected);
  });
});

describe('entryTimes', () => {
  it('shows Madrid time and flags a changed estimate', () => {
    expect(entryTimes(entry({ estimatedAt: '2026-10-31T09:07:00Z' }))).toEqual({
      scheduled: '10:00',
      estimated: '10:07',
      changed: true,
    });
  });

  it('is unchanged without an estimate', () => {
    expect(entryTimes(entry())).toEqual({
      scheduled: '10:00',
      estimated: undefined,
      changed: false,
    });
  });
});

it('builds the Station board path', () => {
  expect(stationBoardPath('60000')).toBe('/stations/60000');
});
