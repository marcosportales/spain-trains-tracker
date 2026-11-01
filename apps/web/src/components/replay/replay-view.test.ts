import type { SightingWindow, WindowSighting } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  advance,
  defaultWindowStart,
  indexSightings,
  replayRuns,
  STALE_AFTER_MS,
  sightingWindowUrl,
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
