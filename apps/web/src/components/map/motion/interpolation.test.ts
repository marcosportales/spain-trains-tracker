import type { TrackFeatureCollection } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import { easeInOut, lerp, makeMotion, trackPathsByLine } from './interpolation';

// A "V" shaped Track geometry: east along the equator, then north. A straight line between its
// ends would cut the corner, so any point on the corner proves we followed the Track.
const V: TrackFeatureCollection = {
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
      properties: { lineCode: 'C1', shapeId: 's1' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [10, 10],
            [10.1, 10],
          ],
          [
            [20, 20],
            [20.1, 20],
          ],
        ],
      },
      properties: { lineCode: 'C2', shapeId: 's2' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      },
      properties: { shapeId: 'orphan' },
    },
  ],
};

describe('trackPathsByLine', () => {
  const paths = trackPathsByLine(V);

  it('groups Track geometry by Line, flattening MultiLineStrings', () => {
    expect(paths.get('C1')).toHaveLength(1);
    expect(paths.get('C2')).toHaveLength(2);
  });

  it('ignores features without a lineCode', () => {
    expect([...paths.keys()].sort()).toEqual(['C1', 'C2']);
  });
});

describe('easing', () => {
  it('eases in and out between 0 and 1', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });

  it('clamps out-of-range progress', () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
  });

  it('lerps coordinates', () => {
    expect(lerp([0, 0], [10, 20], 0.5)).toEqual([5, 10]);
  });
});

describe('makeMotion', () => {
  const paths = trackPathsByLine(V);

  it('moves a Cercanías Run along the Track geometry, not through the corner', () => {
    const motion = makeMotion({
      from: [0.1, 0],
      to: [0.2, 0.1],
      serviceType: 'cercanias',
      paths: paths.get('C1'),
    });
    const [lon, lat] = motion(0.5);
    // Halfway along the Track is the corner (0.2, 0); the straight line would be (0.15, 0.05).
    expect(lon).toBeCloseTo(0.2, 2);
    expect(lat).toBeCloseTo(0, 2);
  });

  it('starts at `from` and ends at `to` exactly', () => {
    const motion = makeMotion({
      from: [0.1, 0],
      to: [0.2, 0.1],
      serviceType: 'cercanias',
      paths: paths.get('C1'),
    });
    expect(motion(0)).toEqual([0.1, 0]);
    expect(motion(1)).toEqual([0.2, 0.1]);
  });

  it('moves backwards along the Track', () => {
    const motion = makeMotion({
      from: [0.2, 0.1],
      to: [0.1, 0],
      serviceType: 'cercanias',
      paths: paths.get('C1'),
    });
    const [lon, lat] = motion(0.5);
    expect(lon).toBeCloseTo(0.2, 2);
    expect(lat).toBeCloseTo(0, 2);
  });

  it.each(['ave', 'larga_distancia', 'media_distancia'] as const)(
    'eases %s Runs on a straight line even when Track geometry exists',
    (serviceType) => {
      const motion = makeMotion({
        from: [0.1, 0],
        to: [0.2, 0.1],
        serviceType,
        paths: paths.get('C1'),
      });
      const [lon, lat] = motion(0.5);
      expect(lon).toBeCloseTo(0.15);
      expect(lat).toBeCloseTo(0.05);
      const [earlyLon] = motion(0.1);
      expect(earlyLon).toBeLessThan(0.1 + 0.1 * 0.1); // eased: slower than linear at first
    },
  );

  it('falls back to a straight line when the Line has no Track geometry', () => {
    const motion = makeMotion({ from: [0, 0], to: [2, 2], serviceType: 'cercanias' });
    expect(motion(0.5)).toEqual([1, 1]);
  });

  it('falls back to a straight line when a position is far from the Track', () => {
    const motion = makeMotion({
      from: [0.1, 0],
      to: [0.2, 1], // ~100 km north of the Track
      serviceType: 'cercanias',
      paths: paths.get('C1'),
    });
    expect(motion(0.5)[1]).toBeCloseTo(0.5);
  });

  it('picks the path of a MultiLineString that both positions sit on', () => {
    const motion = makeMotion({
      from: [20.02, 20],
      to: [20.08, 20],
      serviceType: 'cercanias',
      paths: paths.get('C2'),
    });
    expect(motion(0.5)[0]).toBeCloseTo(20.05, 2);
  });

  it('stays put when the Run has not moved', () => {
    const motion = makeMotion({
      from: [0.1, 0],
      to: [0.1, 0],
      serviceType: 'cercanias',
      paths: paths.get('C1'),
    });
    expect(motion(0.5)).toEqual([0.1, 0]);
  });
});
