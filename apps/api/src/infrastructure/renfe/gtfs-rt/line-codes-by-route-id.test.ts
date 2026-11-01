import { describe, expect, it } from 'vitest';
import { LineCodesByRouteId } from './line-codes-by-route-id.js';

const lines = { listLines: async () => [{ code: '10-C1' }, { code: '10-C10' }, { code: '51-C2' }] };

describe('LineCodesByRouteId', () => {
  const lookup = new LineCodesByRouteId(lines);

  it('derives the Line code from a Cercanías route id: hub prefix and short name', async () => {
    const result = await lookup.lineCodesForRouteIds(['10T0001C1', '10T0003C10', '51T0002C2']);
    expect([...result]).toEqual([
      ['10T0001C1', '10-C1'],
      ['10T0003C10', '10-C10'],
      ['51T0002C2', '51-C2'],
    ]);
  });

  it('leaves out route ids that are malformed or whose Line is unknown', async () => {
    const result = await lookup.lineCodesForRouteIds(['NOPE', '10T0001C9', '']);
    expect(result.size).toBe(0);
  });
});
