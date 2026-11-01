import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { InvalidNetworkValueError } from './errors.js';
import { createHub, HUBS, hubCodeFromCercaniasId, hubNameFor } from './hub.js';

const fixture = new URL('../../../test/fixtures/2026-10-31/flota.json', import.meta.url);
const fixtureHubCodes = [
  ...new Set(
    (JSON.parse(readFileSync(fixture, 'utf8')) as { trenes: { nucleo: string }[] }).trenes.map(
      (t) => t.nucleo,
    ),
  ),
];

describe('Hub code → name table', () => {
  it('has fixture data to check against', () => {
    expect(fixtureHubCodes.length).toBeGreaterThan(5);
  });

  it.each(fixtureHubCodes)('maps fixture hub code %s to a name', (code) => {
    expect(hubNameFor(code)).toBeTruthy();
  });

  it.each([
    ['10', 'Madrid'],
    ['20', 'Asturias'],
    ['30', 'Sevilla'],
    ['40', 'Valencia'],
    ['50', 'Rodalies de Catalunya'],
    ['51', 'Rodalies de Catalunya'],
    ['60', 'Bilbao'],
    ['61', 'San Sebastián'],
    ['62', 'Santander'],
  ])('maps %s to %s', (code, name) => {
    expect(hubNameFor(code)).toBe(name);
  });

  it('returns undefined for an unknown code', () => {
    expect(hubNameFor('99')).toBeUndefined();
  });

  it('has a valid two-digit code and a name for every entry', () => {
    for (const hub of HUBS) {
      expect(hub.code).toMatch(/^\d{2}$/);
      expect(hub.name).not.toBe('');
    }
  });
});

describe('createHub', () => {
  it('creates a hub from a known code', () => {
    expect(createHub('10')).toEqual({ code: '10', name: 'Madrid' });
  });

  it('creates a hub with an explicit name', () => {
    expect(createHub('99', 'Nowhere')).toEqual({ code: '99', name: 'Nowhere' });
  });

  it.each(['', '  ', '1', '100', 'ab'])('rejects invalid code %j', (code) => {
    expect(() => createHub(code, 'X')).toThrow(InvalidNetworkValueError);
  });

  it('rejects an unknown code without a name', () => {
    expect(() => createHub('99')).toThrow(InvalidNetworkValueError);
  });

  it('rejects an empty name', () => {
    expect(() => createHub('10', ' ')).toThrow(InvalidNetworkValueError);
  });
});

describe('hubCodeFromCercaniasId', () => {
  it('takes the first two digits of a Cercanías id', () => {
    expect(hubCodeFromCercaniasId('10T0001C1')).toBe('10');
    expect(hubCodeFromCercaniasId('50600')).toBe('50');
  });

  it('returns undefined when the id does not start with two digits', () => {
    expect(hubCodeFromCercaniasId('C1')).toBeUndefined();
    expect(hubCodeFromCercaniasId('')).toBeUndefined();
  });
});
