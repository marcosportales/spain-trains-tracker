import { describe, expect, it } from 'vitest';
import { STATIONS_MIN_ZOOM, toStationFeatures } from './stations';

describe('toStationFeatures', () => {
  it('turns Stations into point features keyed by code', () => {
    const collection = toStationFeatures([{ code: '60000', name: 'Atocha', lat: 40.4, lon: -3.7 }]);
    expect(collection.features).toEqual([
      {
        type: 'Feature',
        id: '60000',
        geometry: { type: 'Point', coordinates: [-3.7, 40.4] },
        properties: { code: '60000', name: 'Atocha' },
      },
    ]);
  });

  it('only shows Stations once zoomed in', () => {
    expect(STATIONS_MIN_ZOOM).toBeGreaterThanOrEqual(8);
  });
});
