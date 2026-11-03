import { describe, expect, it } from 'vitest';
import { markerImages, runIconId } from './marker-icons';

describe('markerImages', () => {
  const light = markerImages('light');
  const dark = markerImages('dark');

  it('has a badge for every icon a Run can be drawn with', () => {
    for (const type of [
      'cercanias',
      'ave',
      'larga_distancia',
      'media_distancia',
      'ancho_metrico',
      undefined,
    ] as const) {
      for (const snapped of [false, true]) expect(light[runIconId(type, snapped)]).toBeDefined();
    }
  });

  it('fills a Run badge with its Service type colour, a white train and the dot outline', () => {
    expect(light['run-ave']).toMatchObject({
      glyph: 'train',
      fill: '#ad9bfa',
      glyphColor: '#ffffff',
      stroke: 'rgba(24, 24, 27, 0.55)',
    });
    expect(dark['run-cercanias']).toMatchObject({ fill: '#0c8568', glyphColor: '#ffffff' });
  });

  it('draws a Run with no known Service type in muted ink', () => {
    expect(light['run-unknown']).toMatchObject({ fill: '#71717a' });
  });

  it('draws a snapped Run hollow: surface fill, train and border in its Service type colour', () => {
    expect(dark['run-hollow-larga_distancia']).toMatchObject({
      fill: '#1d1f23',
      stroke: '#257bf1',
      glyphColor: '#257bf1',
    });
  });

  it('frames late Runs in their Delay band colour, without a glyph', () => {
    expect(light['run-ring-late']).toMatchObject({ stroke: '#c27c00' });
    expect(light['run-ring-severely_late']).toMatchObject({ stroke: '#d6382f' });
    expect(light['run-ring-late']?.glyph).toBeUndefined();
    expect(light['run-ring-late']?.size).toBeGreaterThan(light['run-ave']?.size ?? 0);
  });

  it('draws a Station as an ink badge with a surface-coloured station glyph, and frames the selected one in accent', () => {
    expect(light.station).toMatchObject({
      glyph: 'station',
      fill: '#18181b',
      stroke: '#ffffff',
      glyphColor: '#ffffff',
    });
    expect(dark['station-selected']).toMatchObject({ stroke: '#6ea8fe' });
  });
});
