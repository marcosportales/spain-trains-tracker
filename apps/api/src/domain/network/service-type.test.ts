import { describe, expect, it } from 'vitest';
import { isServiceType, SERVICE_TYPES } from './service-type.js';

describe('ServiceType', () => {
  it('lists the five commercial families', () => {
    expect([...SERVICE_TYPES]).toEqual([
      'cercanias',
      'ave',
      'larga_distancia',
      'media_distancia',
      'ancho_metrico',
    ]);
  });

  it('guards unknown values', () => {
    expect(isServiceType('ave')).toBe(true);
    expect(isServiceType('bus')).toBe(false);
    expect(isServiceType(3)).toBe(false);
  });
});
