import { describe, expect, it } from 'vitest';
import { ServiceType } from './service-type.js';

describe('ServiceType', () => {
  it.each(['cercanias', 'ave', 'larga_distancia', 'media_distancia', 'ancho_metrico'])(
    'accepts %s',
    (value) => {
      expect(ServiceType.parse(value)).toBe(value);
    },
  );

  it.each(['AVE', 'cercanías', 'regional', '', 42, null, undefined])('rejects %j', (value) => {
    expect(ServiceType.safeParse(value).success).toBe(false);
  });
});
