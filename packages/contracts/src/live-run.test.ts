import { describe, expect, it } from 'vitest';
import { LiveRun } from './live-run.js';

const valid = {
  trainNumber: '03063',
  serviceDate: '2026-10-31',
  serviceType: 'ave',
  lat: 40.4065,
  lon: -3.6892,
  status: 'in_transit_to',
  sources: ['official'],
  observedAt: '2026-10-31T10:15:30Z',
};

describe('LiveRun', () => {
  it('accepts a minimal Run', () => {
    expect(LiveRun.parse(valid)).toEqual(valid);
  });

  it('accepts a Run with every optional field', () => {
    const full = {
      ...valid,
      lineCode: 'C1',
      delaySeconds: 240,
      nextStationCode: '60000',
      sources: ['official', 'visor'],
    };
    expect(LiveRun.parse(full)).toEqual(full);
  });

  it('accepts a negative delay (running early)', () => {
    expect(LiveRun.safeParse({ ...valid, delaySeconds: -60 }).success).toBe(true);
  });

  it.each([
    ['missing trainNumber', { trainNumber: undefined }],
    ['bad trainNumber', { trainNumber: 'C1-23579' }],
    ['bad serviceDate', { serviceDate: '2026-02-30' }],
    ['unknown serviceType', { serviceType: 'regional' }],
    ['lat above 90', { lat: 90.5 }],
    ['lat below -90', { lat: -91 }],
    ['lon above 180', { lon: 181 }],
    ['lon below -180', { lon: -180.1 }],
    ['non-finite lat', { lat: Number.NaN }],
    ['lat as string', { lat: '40.4' }],
    ['unknown status', { status: 'lost' }],
    ['fractional delaySeconds', { delaySeconds: 1.5 }],
    ['empty lineCode', { lineCode: '' }],
    ['empty nextStationCode', { nextStationCode: '' }],
    ['empty sources', { sources: [] }],
    ['unknown source', { sources: ['adif'] }],
    ['duplicate sources', { sources: ['official', 'official'] }],
    ['observedAt not ISO', { observedAt: 'yesterday' }],
    ['observedAt without time zone', { observedAt: '2026-10-31T10:15:30' }],
  ])('rejects %s', (_label, override) => {
    expect(LiveRun.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
