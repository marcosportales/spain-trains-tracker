import type { SightingWindow, WindowSighting } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  advance,
  candidateStarts,
  defaultWindowStart,
  findLatestWindow,
  fromMadridInputValue,
  indexSightings,
  LOOKBACK_HOURS,
  replayRuns,
  STALE_AFTER_MS,
  sightingWindowUrl,
  toMadridInputValue,
  WINDOW_MS,
} from './replay-view';

const T0 = Date.parse('2026-10-31T10:00:00Z');
const at = (seconds: number) => new Date(T0 + seconds * 1000).toISOString();

const sighting = (over: Partial<WindowSighting> & { s: number }): WindowSighting => {
  const { s, ...rest } = over;
  return {
    trainNumber: '03063',
    serviceDate: '2026-10-31',
    source: 'official',
    observedAt: at(s),
    lat: 40,
    lon: -3,
    status: 'in_transit_to',
    positionIsSnapped: false,
    ...rest,
  };
};

const windowOf = (sightings: WindowSighting[]): SightingWindow => ({
  from: at(0),
  to: at(3600),
  stepSeconds: 60,
  sightings,
});

describe('replayRuns', () => {
  it('shows the latest Sighting of each Run at or before the instant', () => {
    const index = indexSightings(
      windowOf([
        sighting({ s: 0, lat: 40 }),
        sighting({ s: 60, lat: 41 }),
        sighting({ s: 120, lat: 42 }),
      ]),
    );
    expect(replayRuns(index, T0 + 90_000).get('2026-10-31:03063')?.lat).toBe(41);
    expect(replayRuns(index, T0 + 120_000).get('2026-10-31:03063')?.lat).toBe(42);
  });
  it('hides a Run before its first Sighting', () => {
    const index = indexSightings(windowOf([sighting({ s: 60 })]));
    expect(replayRuns(index, T0 + 30_000).size).toBe(0);
  });
  it('hides a Run whose last Sighting is stale', () => {
    const index = indexSightings(windowOf([sighting({ s: 0 })]));
    expect(replayRuns(index, T0 + STALE_AFTER_MS).size).toBe(1);
    expect(replayRuns(index, T0 + STALE_AFTER_MS + 1).size).toBe(0);
  });
  it('tracks Runs independently and prefers the Official feed on a tie', () => {
    const index = indexSightings(
      windowOf([
        sighting({ s: 0, source: 'visor', lat: 1 }),
        sighting({ s: 0, source: 'official', lat: 2 }),
        sighting({ s: 0, trainNumber: '00001', lat: 3 }),
      ]),
    );
    const runs = replayRuns(index, T0);
    expect(runs.size).toBe(2);
    expect(runs.get('2026-10-31:03063')).toMatchObject({ lat: 2, sources: ['official'] });
    expect(runs.get('2026-10-31:00001')?.lat).toBe(3);
  });
  it('maps a Sighting to a map Run without a Service type', () => {
    const index = indexSightings(
      windowOf([sighting({ s: 0, stationCode: '71801', positionIsSnapped: true })]),
    );
    expect(replayRuns(index, T0).get('2026-10-31:03063')).toEqual({
      trainNumber: '03063',
      serviceDate: '2026-10-31',
      lat: 40,
      lon: -3,
      status: 'in_transit_to',
      sources: ['official'],
      observedAt: at(0),
      nextStationCode: '71801',
    });
  });
});

describe('advance', () => {
  it('moves the playhead by real elapsed time times the speed', () =>
    expect(advance({ position: 0, elapsedMs: 1000, speed: 60, length: WINDOW_MS })).toEqual({
      position: 60_000,
      ended: false,
    }));
  it('stops at the end of the window', () =>
    expect(
      advance({ position: WINDOW_MS - 1000, elapsedMs: 1000, speed: 60, length: WINDOW_MS }),
    ).toEqual({ position: WINDOW_MS, ended: true }));
});

describe('sightingWindowUrl', () => {
  it('asks for the window starting at `from`', () =>
    expect(sightingWindowUrl(new Date(T0), 'http://api')).toBe(
      `http://api/sightings?from=${encodeURIComponent(at(0))}&to=${encodeURIComponent(
        new Date(T0 + WINDOW_MS).toISOString(),
      )}`,
    ));
});

describe('defaultWindowStart', () => {
  it('is the start of the last full hour before now', () =>
    expect(defaultWindowStart(new Date('2026-10-31T10:42:10Z')).toISOString()).toBe(
      '2026-10-31T09:00:00.000Z',
    ));
});

describe('candidateStarts', () => {
  const now = new Date('2026-10-25T01:30:00+01:00'); // 00:30 UTC, DST ends this night in Madrid

  it('returns LOOKBACK_HOURS hours, the last full hour first, then each hour before', () => {
    const starts = candidateStarts(now);
    expect(starts).toHaveLength(LOOKBACK_HOURS);
    expect(starts.map((d) => d.toISOString())).toEqual([
      '2026-10-24T23:00:00.000Z',
      '2026-10-24T22:00:00.000Z',
      '2026-10-24T21:00:00.000Z',
      '2026-10-24T20:00:00.000Z',
      '2026-10-24T19:00:00.000Z',
      '2026-10-24T18:00:00.000Z',
    ]);
  });

  it('starts at the same hour as defaultWindowStart and honours a custom count', () => {
    const starts = candidateStarts(now, 2);
    expect(starts).toHaveLength(2);
    expect(starts[0]).toEqual(defaultWindowStart(now));
  });
});

describe('findLatestWindow', () => {
  const starts = [0, 1, 2].map((i) => new Date(T0 - i * WINDOW_MS));
  const empty = windowOf([]);
  const full = windowOf([sighting({ s: 10 })]);

  it('stops at the first window with Sightings, fetching one at a time', async () => {
    const calls: number[] = [];
    const result = await findLatestWindow(async (from) => {
      calls.push(from.getTime());
      return calls.length === 2 ? full : empty;
    }, starts);
    expect(result).toEqual({ status: 'found', from: starts[1], window: full });
    expect(calls).toEqual([starts[0]?.getTime(), starts[1]?.getTime()]);
  });

  it('is none when every window is empty', async () => {
    expect(await findLatestWindow(async () => empty, starts)).toEqual({ status: 'none' });
  });

  it('is error, without trying the next hour, when a request fails', async () => {
    let calls = 0;
    const result = await findLatestWindow(async () => {
      calls++;
      throw new Error('boom');
    }, starts);
    expect(result).toEqual({ status: 'error' });
    expect(calls).toBe(1);
  });

  it('stops looping once aborted', async () => {
    const controller = new AbortController();
    let calls = 0;
    const result = await findLatestWindow(
      async () => {
        calls++;
        controller.abort();
        return empty;
      },
      starts,
      controller.signal,
    );
    expect(result).toEqual({ status: 'aborted' });
    expect(calls).toBe(1);
  });
});

describe('Madrid input helpers', () => {
  it('shows an instant as Madrid wall-clock time', () => {
    expect(toMadridInputValue(new Date('2026-01-15T10:00:00Z'))).toBe('2026-01-15T11:00');
    expect(toMadridInputValue(new Date('2026-07-15T10:00:00Z'))).toBe('2026-07-15T12:00');
  });

  it('reads an input value as Madrid time', () => {
    expect(fromMadridInputValue('2026-01-15T11:00')?.toISOString()).toBe(
      '2026-01-15T10:00:00.000Z',
    );
    expect(fromMadridInputValue('2026-07-15T12:00')?.toISOString()).toBe(
      '2026-07-15T10:00:00.000Z',
    );
  });

  it('rejects a value that is not a date', () => {
    expect(fromMadridInputValue('')).toBeNull();
  });

  it('round-trips every hour of the March change day (last Sunday, 2026-03-29)', () => {
    for (let h = 0; h < 24; h++) {
      const date = new Date(Date.UTC(2026, 2, 28, 23) + h * WINDOW_MS);
      expect(fromMadridInputValue(toMadridInputValue(date))?.getTime()).toBe(date.getTime());
    }
    // 02:00 does not exist: 01:00Z is already 03:00 in Madrid.
    expect(toMadridInputValue(new Date('2026-03-29T01:00:00Z'))).toBe('2026-03-29T03:00');
    expect(toMadridInputValue(new Date('2026-03-29T00:00:00Z'))).toBe('2026-03-29T01:00');
  });

  it('round-trips the October change day (last Sunday, 2026-10-25)', () => {
    // 02:00 happens twice: 00:00Z (summer time) and 01:00Z (winter time).
    const first = new Date('2026-10-25T00:00:00Z');
    const second = new Date('2026-10-25T01:00:00Z');
    expect(toMadridInputValue(first)).toBe('2026-10-25T02:00');
    expect(toMadridInputValue(second)).toBe('2026-10-25T02:00');
    expect(fromMadridInputValue('2026-10-25T02:00')?.getTime()).toBe(first.getTime());
    for (const h of [22, 23, 0, 2, 3, 4]) {
      const date = new Date(Date.UTC(2026, 9, 24, 22) + ((h + 2) % 24) * WINDOW_MS);
      expect(toMadridInputValue(fromMadridInputValue(toMadridInputValue(date)) as Date)).toBe(
        toMadridInputValue(date),
      );
    }
    expect(fromMadridInputValue('2026-10-25T03:00')?.toISOString()).toBe(
      '2026-10-25T02:00:00.000Z',
    );
  });
});
