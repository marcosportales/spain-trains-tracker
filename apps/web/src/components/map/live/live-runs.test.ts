import type { LiveRun } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  initialLiveRuns,
  isSnapped,
  liveRunsReducer,
  runKey,
  SERVICE_TYPE_COLORS,
  toFeatureCollection,
} from './live-runs';

const run = (trainNumber: string, over: Partial<LiveRun> = {}): LiveRun => ({
  trainNumber,
  serviceDate: '2026-10-31',
  serviceType: 'cercanias',
  lineCode: 'C1',
  lat: 40.4,
  lon: -3.7,
  status: 'in_transit_to',
  sources: ['official'],
  observedAt: '2026-10-31T10:00:00+01:00',
  ...over,
});

describe('liveRunsReducer', () => {
  it('replaces everything on snapshot', () => {
    const before = liveRunsReducer(initialLiveRuns, {
      type: 'snapshot',
      runs: [run('1'), run('2')],
    });
    const after = liveRunsReducer(before, { type: 'snapshot', runs: [run('3')] });
    expect([...after.keys()]).toEqual([runKey(run('3'))]);
  });

  it('upserts and removes on diff, leaving untouched Runs as the same objects', () => {
    const before = liveRunsReducer(initialLiveRuns, {
      type: 'snapshot',
      runs: [run('1'), run('2')],
    });
    const moved = run('2', { lat: 41 });
    const after = liveRunsReducer(before, {
      type: 'diff',
      upserted: [moved, run('3')],
      removed: [{ trainNumber: '1', serviceDate: '2026-10-31' }],
    });
    expect([...after.keys()].sort()).toEqual([runKey(run('2')), runKey(run('3'))].sort());
    expect(after.get(runKey(moved))).toBe(moved);
  });

  it('does not mutate the previous state', () => {
    const before = liveRunsReducer(initialLiveRuns, { type: 'snapshot', runs: [run('1')] });
    liveRunsReducer(before, {
      type: 'diff',
      upserted: [],
      removed: [{ trainNumber: '1', serviceDate: '2026-10-31' }],
    });
    expect(before.size).toBe(1);
  });

  it('clears on reset', () => {
    const before = liveRunsReducer(initialLiveRuns, { type: 'snapshot', runs: [run('1')] });
    expect(liveRunsReducer(before, { type: 'reset' }).size).toBe(0);
  });
});

describe('isSnapped', () => {
  it('is true only for station-snapped statuses', () => {
    expect(isSnapped(run('1', { status: 'stopped_at' }))).toBe(true);
    expect(isSnapped(run('1', { status: 'incoming_at' }))).toBe(true);
    expect(isSnapped(run('1', { status: 'in_transit_to' }))).toBe(false);
  });
});

describe('toFeatureCollection', () => {
  it('maps Runs to point features with lon/lat order and display properties', () => {
    const fc = toFeatureCollection(
      new Map([[runKey(run('1')), run('1', { status: 'stopped_at' })]]),
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]).toMatchObject({
      type: 'Feature',
      id: runKey(run('1')),
      geometry: { type: 'Point', coordinates: [-3.7, 40.4] },
      properties: { serviceType: 'cercanias', label: 'C1', snapped: true },
    });
  });

  it('falls back to the train number when there is no Line code', () => {
    const r = run('03063', { serviceType: 'ave', lineCode: undefined });
    const fc = toFeatureCollection(new Map([[runKey(r), r]]));
    expect(fc.features[0]?.properties.label).toBe('03063');
  });
});

describe('SERVICE_TYPE_COLORS', () => {
  it('has a color for every Service type', () => {
    expect(Object.keys(SERVICE_TYPE_COLORS).sort()).toEqual([
      'ancho_metrico',
      'ave',
      'cercanias',
      'larga_distancia',
      'media_distancia',
    ]);
  });
});
