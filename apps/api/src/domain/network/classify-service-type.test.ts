import { describe, expect, it } from 'vitest';
import { classifyServiceType } from './classify-service-type.js';

describe('classifyServiceType', () => {
  it.each([
    ['AVE', 'ave'],
    ['AVLO', 'ave'],
    ['ALVIA', 'larga_distancia'],
    ['Intercity', 'larga_distancia'],
    ['Euromed', 'larga_distancia'],
    ['AVANT', 'media_distancia'],
    ['MD', 'media_distancia'],
    ['Regional', 'media_distancia'],
    ['REGIONAL', 'media_distancia'],
    ['R11', 'media_distancia'],
    ['R-14', 'media_distancia'],
    ['TRENCELTA', 'media_distancia'],
    ['Feve Cantabria', 'ancho_metrico'],
    ['Ancho Métrico', 'ancho_metrico'],
    ['SOMETHING NEW', 'larga_distancia'],
  ] as const)('AV/LD/MD feed: %s → %s', (shortName, expected) => {
    expect(classifyServiceType({ feed: 'larga-distancia', shortName })).toBe(expected);
  });

  it('classifies Cercanías feed routes as cercanias', () => {
    expect(classifyServiceType({ feed: 'cercanias', shortName: 'C1' })).toBe('cercanias');
    expect(classifyServiceType({ feed: 'cercanias', shortName: 'R2 Sud' })).toBe('cercanias');
  });

  it('classifies Cercanías routes that only use metre-gauge Stations as ancho_metrico', () => {
    expect(
      classifyServiceType({ feed: 'cercanias', shortName: 'C1', onlyMetreGaugeStations: true }),
    ).toBe('ancho_metrico');
  });

  it('does not mistake Avant for AVE', () => {
    expect(classifyServiceType({ feed: 'larga-distancia', shortName: 'Avant' })).not.toBe('ave');
  });
});
