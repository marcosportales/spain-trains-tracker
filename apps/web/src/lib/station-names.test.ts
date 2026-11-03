import { describe, expect, it } from 'vitest';
import { stationNames } from './station-names';

describe('stationNames', () => {
  const names = stationNames([
    { code: '60000', name: 'Madrid Puerta de Atocha', lat: 40.4, lon: -3.7 },
  ]);

  it('maps a known code to its name', () => {
    expect(names('60000')).toBe('Madrid Puerta de Atocha');
  });

  it('falls back to the code for an unknown one', () => {
    expect(names('99999')).toBe('99999');
  });
});
