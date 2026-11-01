import { describe, expect, it } from 'vitest';
import { matchTrackGeometry, type OsmWay } from './track-matching.js';

// A straight east-west track at lat 40, one vertex every 0.01° (~850 m), plus a branch going north.
const main: OsmWay = [0, 1, 2, 3, 4, 5].map((i) => [-3 + i * 0.01, 40] as const);
const branch: OsmWay = [
  [-2.97, 40],
  [-2.97, 40.01],
  [-2.97, 40.02],
];
const at = (lonIndex: number, dLat = 0) => ({ lat: 40 + dLat, lon: -3 + lonIndex * 0.01 });

describe('matchTrackGeometry', () => {
  it('follows the track between consecutive Stations', () => {
    const result = matchTrackGeometry([main], [at(0), at(2), at(5)]);
    expect(result?.path).toEqual(main);
    expect(result?.matchedStations).toBe(3);
  });

  it('snaps Stations that sit off the track and ignores unrelated branches', () => {
    const result = matchTrackGeometry([main, branch], [at(0, 0.001), at(5, -0.001)]);
    expect(result?.path).toEqual(main);
  });

  it('joins ways that share an end vertex, whatever their direction', () => {
    const first = main.slice(0, 3);
    const second = main.slice(2).reverse();
    expect(matchTrackGeometry([first, second], [at(0), at(5)])?.path).toEqual(main);
  });

  it('takes the shortest route at a junction', () => {
    const result = matchTrackGeometry([main, branch], [at(0), { lat: 40.02, lon: -2.97 }]);
    expect(result?.path.at(-1)).toEqual([-2.97, 40.02]);
    expect(result?.path).toHaveLength(6); // 4 main vertices up to the junction + 2 branch vertices
  });

  it('drops a Station farther than the snap distance from any track and keeps the rest', () => {
    const result = matchTrackGeometry([main], [at(0), at(2, 0.1), at(5)]);
    expect(result?.matchedStations).toBe(2);
    expect(result?.path).toEqual(main);
  });

  it('drops a Station that is not connected to the rest of the track', () => {
    const island: OsmWay = [
      [-2, 41],
      [-1.99, 41],
    ];
    const result = matchTrackGeometry([main, island], [at(0), { lat: 41, lon: -2 }, at(5)]);
    expect(result?.matchedStations).toBe(2);
    expect(result?.path).toEqual(main);
  });

  it('gives nothing when fewer than two Stations can be matched', () => {
    expect(matchTrackGeometry([main], [at(0), at(2, 0.1)])).toBeUndefined();
    expect(matchTrackGeometry([], [at(0), at(5)])).toBeUndefined();
  });
});
