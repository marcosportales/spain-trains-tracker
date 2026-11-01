import { describe, expect, it } from 'vitest';
import { InvalidNetworkValueError } from './errors.js';
import { createLine } from './line.js';

const valid = {
  code: 'C1',
  name: 'Príncipe Pío – Aeropuerto T4',
  serviceType: 'cercanias',
} as const;

describe('createLine', () => {
  it('creates a line with optional hubCode and color', () => {
    const line = createLine({ ...valid, hubCode: '10', color: '75B6E0' });
    expect(line).toEqual({ ...valid, hubCode: '10', color: '75B6E0' });
  });

  it('trims the code and name', () => {
    expect(createLine({ ...valid, code: ' C1 ', name: ' X ' })).toMatchObject({
      code: 'C1',
      name: 'X',
    });
  });

  it.each(['', '  '])('rejects empty code %j', (code) => {
    expect(() => createLine({ ...valid, code })).toThrow(InvalidNetworkValueError);
  });

  it('rejects an empty name', () => {
    expect(() => createLine({ ...valid, name: '' })).toThrow(InvalidNetworkValueError);
  });

  it('rejects an unknown service type', () => {
    expect(() => createLine({ ...valid, serviceType: 'bus' as never })).toThrow(
      InvalidNetworkValueError,
    );
  });

  it.each(['red', '#75B6E0', '75B6E'])('rejects invalid color %j', (color) => {
    expect(() => createLine({ ...valid, color })).toThrow(InvalidNetworkValueError);
  });
});
