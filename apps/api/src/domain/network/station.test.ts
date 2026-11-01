import { describe, expect, it } from 'vitest';
import { InvalidNetworkValueError } from './errors.js';
import { createStation } from './station.js';

const valid = {
  code: '60000',
  name: 'Madrid Atocha',
  lat: 40.4065,
  lon: -3.6892,
  serviceTypes: ['cercanias', 'ave'] as const,
};

describe('createStation', () => {
  it('creates a station and trims the code and name', () => {
    const station = createStation({ ...valid, code: ' 60000 ', name: ' Madrid Atocha ' });
    expect(station).toMatchObject({ code: '60000', name: 'Madrid Atocha', lat: 40.4065 });
  });

  it('keeps optional hubCode and wheelchairBoarding', () => {
    const station = createStation({ ...valid, hubCode: '10', wheelchairBoarding: true });
    expect(station.hubCode).toBe('10');
    expect(station.wheelchairBoarding).toBe(true);
  });

  it('deduplicates service types', () => {
    const station = createStation({ ...valid, serviceTypes: ['ave', 'ave', 'cercanias'] });
    expect(station.serviceTypes).toEqual(['ave', 'cercanias']);
  });

  it.each(['', '   '])('rejects empty code %j', (code) => {
    expect(() => createStation({ ...valid, code })).toThrow(InvalidNetworkValueError);
  });

  it('rejects an empty name', () => {
    expect(() => createStation({ ...valid, name: ' ' })).toThrow(InvalidNetworkValueError);
  });

  it.each([
    ['lat', 90.01],
    ['lat', -90.01],
    ['lon', 180.01],
    ['lon', -180.01],
    ['lat', Number.NaN],
    ['lon', Number.POSITIVE_INFINITY],
  ] as const)('rejects invalid %s %s', (field, value) => {
    expect(() => createStation({ ...valid, [field]: value })).toThrow(InvalidNetworkValueError);
  });

  it('accepts boundary coordinates', () => {
    expect(() => createStation({ ...valid, lat: 90, lon: -180 })).not.toThrow();
  });

  it('rejects an empty or unknown service type list', () => {
    expect(() => createStation({ ...valid, serviceTypes: [] })).toThrow(InvalidNetworkValueError);
    expect(() => createStation({ ...valid, serviceTypes: ['bus' as never] })).toThrow(
      InvalidNetworkValueError,
    );
  });

  it('rejects a malformed hubCode', () => {
    expect(() => createStation({ ...valid, hubCode: '' })).toThrow(InvalidNetworkValueError);
  });
});
