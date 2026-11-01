import { describe, expect, it } from 'vitest';
import { isSource, SOURCES } from './source.js';

describe('Source', () => {
  it('lists the four feeds', () => {
    expect([...SOURCES]).toEqual(['gtfsrt_cercanias', 'gtfsrt_ld', 'visor_ld', 'visor_cercanias']);
  });

  it('recognizes only known Sources', () => {
    expect(isSource('visor_ld')).toBe(true);
    expect(isSource('visor')).toBe(false);
    expect(isSource(undefined)).toBe(false);
  });
});
