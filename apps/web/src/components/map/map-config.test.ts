import { describe, expect, it } from 'vitest';
import { ATTRIBUTION, MAP_STYLE_URL, SPAIN_VIEW } from './map-config';

describe('map config', () => {
  it('uses the OpenFreeMap liberty style', () => {
    expect(MAP_STYLE_URL).toBe('https://tiles.openfreemap.org/styles/liberty');
  });

  it('is centered on mainland Spain', () => {
    const [lng, lat] = SPAIN_VIEW.center;
    expect(lng).toBeGreaterThan(-9.5);
    expect(lng).toBeLessThan(3.5);
    expect(lat).toBeGreaterThan(36);
    expect(lat).toBeLessThan(44);
  });

  it('credits OSM, OpenFreeMap and Renfe', () => {
    const text = ATTRIBUTION.map((a) => a.label).join(' ');
    expect(text).toContain('OpenStreetMap');
    expect(text).toContain('OpenFreeMap');
    expect(text).toContain('Renfe');
    for (const a of ATTRIBUTION) expect(a.href).toMatch(/^https:\/\//);
  });
});
