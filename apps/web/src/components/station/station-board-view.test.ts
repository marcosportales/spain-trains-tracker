import type { StationBoardEntry } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  boardHeadline,
  entryBand,
  entryTimes,
  stationBoardPath,
  updatedAgo,
} from './station-board-view';

const entry = (over: Partial<StationBoardEntry> = {}): StationBoardEntry => ({
  trainNumber: '03063',
  serviceDate: '2026-10-31',
  serviceType: 'ave',
  counterpartStationCode: '71801',
  scheduledAt: '2026-10-31T09:00:00Z',
  ...over,
});

describe('entryBand', () => {
  it.each([
    [{ serviceStatus: 'cancelled', delaySeconds: 0 }, 'cancelled'],
    [{}, 'unknown'],
    [{ delaySeconds: 30 }, 'on_time'],
    [{ delaySeconds: 299 }, 'on_time'],
    [{ delaySeconds: 300 }, 'late'],
    [{ delaySeconds: 900 }, 'severely_late'],
  ] as const)('%j is %s', (over, expected) => {
    expect(entryBand(entry(over))).toBe(expected);
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

describe('boardHeadline', () => {
  const names = (code: string) => `Name ${code}`;

  it('is empty for a tab with no rows', () => {
    expect(boardHeadline([], 'arrivals', names)).toEqual({ kind: 'empty', tab: 'arrivals' });
  });

  it('skips cancelled rows', () => {
    const rows = [
      entry({ serviceStatus: 'cancelled', counterpartStationCode: '1' }),
      entry({ scheduledAt: '2026-10-31T09:30:00Z', counterpartStationCode: '2' }),
    ];
    expect(boardHeadline(rows, 'departures', names)).toEqual({
      kind: 'next',
      tab: 'departures',
      time: '10:30',
      station: 'Name 2',
      lateCount: 0,
    });
  });

  it('is empty when every row is cancelled', () => {
    const rows = [entry({ serviceStatus: 'cancelled' })];
    expect(boardHeadline(rows, 'departures', names)).toEqual({ kind: 'empty', tab: 'departures' });
  });

  it('prefers the estimated time', () => {
    const rows = [entry({ estimatedAt: '2026-10-31T09:07:00Z', delaySeconds: 420 })];
    expect(boardHeadline(rows, 'departures', names)).toMatchObject({ time: '10:07', lateCount: 1 });
  });

  it('counts only late and severely late rows', () => {
    const rows = [
      entry({ delaySeconds: 60 }),
      entry({ delaySeconds: 300 }),
      entry({ delaySeconds: 1200 }),
      entry({ serviceStatus: 'cancelled' }),
      entry(),
    ];
    expect(boardHeadline(rows, 'departures', names)).toMatchObject({ lateCount: 2 });
  });

  it('uses the origin on arrivals', () => {
    const rows = [entry({ counterpartStationCode: '9' })];
    expect(boardHeadline(rows, 'arrivals', names)).toMatchObject({
      tab: 'arrivals',
      station: 'Name 9',
    });
  });
});

describe('updatedAgo', () => {
  const at = (seconds: number) => updatedAgo(seconds * 1000, 0);

  it('counts seconds under a minute', () => {
    expect(at(0)).toEqual({ unit: 's', value: 0 });
    expect(at(59)).toEqual({ unit: 's', value: 59 });
  });

  it('switches to whole minutes from 60 s', () => {
    expect(at(60)).toEqual({ unit: 'min', value: 1 });
    expect(at(125)).toEqual({ unit: 'min', value: 2 });
  });
});
