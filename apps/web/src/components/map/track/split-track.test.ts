import { lineString } from '@turf/helpers';
import { describe, expect, it } from 'vitest';
import { splitTrack } from './split-track';

const path = (...coordinates: [number, number][]) => lineString(coordinates);

describe('splitTrack', () => {
  const straight = [path([0, 0], [2, 0])];

  it('puts the part towards the next Station in `remaining` (towards at the end)', () => {
    const split = splitTrack(straight, [1, 0], [2, 0]);
    expect(split?.travelled?.coordinates[0]).toEqual([0, 0]);
    expect(split?.travelled?.coordinates.at(-1)?.[0]).toBeCloseTo(1, 3);
    expect(split?.remaining.coordinates[0]?.[0]).toBeCloseTo(1, 3);
    expect(split?.remaining.coordinates.at(-1)).toEqual([2, 0]);
  });

  it('flips the sides when the next Station is at the start of the path', () => {
    const split = splitTrack(straight, [1, 0], [0, 0]);
    expect(split?.remaining.coordinates[0]).toEqual([0, 0]);
    expect(split?.remaining.coordinates.at(-1)?.[0]).toBeCloseTo(1, 3);
    expect(split?.travelled?.coordinates[0]?.[0]).toBeCloseTo(1, 3);
    expect(split?.travelled?.coordinates.at(-1)).toEqual([2, 0]);
  });

  it('keeps the whole path as `remaining` without a direction', () => {
    const split = splitTrack(straight, [1, 0]);
    expect(split?.travelled).toBeUndefined();
    expect(split?.remaining.coordinates).toEqual([
      [0, 0],
      [2, 0],
    ]);
  });

  it('splits the nearest of several paths', () => {
    const far = path([0, 5], [2, 5]);
    const split = splitTrack([far, ...straight], [1, 0.01], [2, 0]);
    expect(split?.remaining.coordinates.at(-1)).toEqual([2, 0]);
  });

  it('keeps bends of the path on the right side of the split', () => {
    const bent = [path([0, 0], [1, 0], [1, 1], [2, 1])];
    const split = splitTrack(bent, [1, 0.5], [2, 1]);
    expect(split?.travelled?.coordinates.slice(0, 2)).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(split?.remaining.coordinates.slice(-2)).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  it('is undefined without paths', () => {
    expect(splitTrack([], [1, 0], [2, 0])).toBeUndefined();
  });
});
