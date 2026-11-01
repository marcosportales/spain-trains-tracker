import type { LiveRun, TrackFeatureCollection } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import { trackPathsByLine } from './interpolation';
import { RunMotions } from './run-motions';

const run = (
  trainNumber: string,
  lon: number,
  lat: number,
  over: Partial<LiveRun> = {},
): LiveRun => ({
  trainNumber,
  serviceDate: '2026-10-31',
  serviceType: 'ave',
  lat,
  lon,
  status: 'in_transit_to',
  sources: ['official'],
  observedAt: '2026-10-31T10:00:00+01:00',
  ...over,
});
const key = (n: string) => `2026-10-31:${n}`;
const map = (...runs: LiveRun[]) => new Map(runs.map((r) => [key(r.trainNumber), r]));

describe('RunMotions', () => {
  it('places a new Run at its position straight away', () => {
    const motions = new RunMotions({ durationMs: 1000 });
    motions.update(map(run('1', 1, 1)), 0);
    expect(motions.positionsAt(0).get(key('1'))).toEqual([1, 1]);
  });

  it('animates towards a new position over the duration', () => {
    const motions = new RunMotions({ durationMs: 1000 });
    motions.update(map(run('1', 0, 0)), 0);
    motions.update(map(run('1', 2, 2)), 100);
    expect(motions.positionsAt(100).get(key('1'))).toEqual([0, 0]);
    expect(motions.positionsAt(600).get(key('1'))).toEqual([1, 1]);
    expect(motions.positionsAt(1100).get(key('1'))).toEqual([2, 2]);
    expect(motions.positionsAt(9999).get(key('1'))).toEqual([2, 2]);
  });

  it('starts a new motion from where the Run is displayed, without jumping', () => {
    const motions = new RunMotions({ durationMs: 1000 });
    motions.update(map(run('1', 0, 0)), 0);
    motions.update(map(run('1', 2, 2)), 0);
    const mid = motions.positionsAt(500).get(key('1')) as [number, number];
    motions.update(map(run('1', 4, 4)), 500);
    expect(motions.positionsAt(500).get(key('1'))).toEqual(mid);
    expect(motions.positionsAt(1500).get(key('1'))).toEqual([4, 4]);
  });

  it('leaves Runs that did not move alone', () => {
    const motions = new RunMotions({ durationMs: 1000 });
    motions.update(map(run('1', 3, 3)), 0);
    motions.update(map(run('1', 3, 3, { delaySeconds: 60 })), 500);
    expect(motions.positionsAt(700).get(key('1'))).toEqual([3, 3]);
  });

  it('forgets Runs that are no longer live', () => {
    const motions = new RunMotions({ durationMs: 1000 });
    motions.update(map(run('1', 0, 0), run('2', 1, 1)), 0);
    motions.update(map(run('2', 1, 1)), 10);
    expect([...motions.positionsAt(10).keys()]).toEqual([key('2')]);
  });

  it('jumps straight to the new position with reduced motion', () => {
    const motions = new RunMotions({ durationMs: 1000, reducedMotion: true });
    motions.update(map(run('1', 0, 0)), 0);
    motions.update(map(run('1', 2, 2)), 100);
    expect(motions.positionsAt(100).get(key('1'))).toEqual([2, 2]);
    expect(motions.isAnimating(100)).toBe(false);
  });

  it('reports whether any Run is still moving', () => {
    const motions = new RunMotions({ durationMs: 1000 });
    motions.update(map(run('1', 0, 0)), 0);
    expect(motions.isAnimating(0)).toBe(false);
    motions.update(map(run('1', 2, 2)), 0);
    expect(motions.isAnimating(500)).toBe(true);
    expect(motions.isAnimating(1000)).toBe(false);
  });

  it('follows the Track geometry of a Cercanías Run', () => {
    const track: TrackFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [0.2, 0],
              [0.2, 0.2],
            ],
          },
          properties: { lineCode: 'C1' },
        },
      ],
    };
    const motions = new RunMotions({ durationMs: 1000, paths: trackPathsByLine(track) });
    const cercanias = { serviceType: 'cercanias' as const, lineCode: 'C1' };
    motions.update(map(run('1', 0.1, 0, cercanias)), 0);
    motions.update(map(run('1', 0.2, 0.1, cercanias)), 0);
    const [lon, lat] = motions.positionsAt(500).get(key('1')) as [number, number];
    expect(lon).toBeCloseTo(0.2, 2);
    expect(lat).toBeCloseTo(0, 2);
  });
});
