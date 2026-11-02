import type { RunDetail, StationBoard } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import { runOgContent, stationOgContent } from './og-content';

const detail = (over: Partial<RunDetail> = {}): RunDetail =>
  ({
    run: {
      trainNumber: '03063',
      serviceDate: '2026-10-31',
      serviceType: 'ave',
      lineCode: 'AVE-MAD-SEV',
    },
    position: {
      lat: 0,
      lon: 0,
      status: 'in_transit_to',
      sources: ['official'],
      observedAt: '2026-10-31T10:15:30Z',
    },
    serviceStatus: 'scheduled',
    stops: [],
    ...over,
  }) as RunDetail;

describe('runOgContent', () => {
  it('carries train number, Line and the Delay badge', () => {
    expect(runOgContent(detail({ delaySeconds: 420 }))).toEqual({
      serviceType: 'ave',
      trainNumber: '03063',
      lineCode: 'AVE-MAD-SEV',
      badge: 'late',
      delayMinutes: 7,
    });
  });

  it('is cancelled when the Service status says so', () => {
    expect(runOgContent(detail({ serviceStatus: 'cancelled' })).badge).toBe('cancelled');
  });
});

describe('stationOgContent', () => {
  const entry = (n: number) => ({
    trainNumber: `0${n}`,
    serviceDate: '2026-10-31',
    serviceType: 'ave' as const,
    counterpartStationCode: '71801',
    scheduledAt: `2026-10-31T0${n}:00:00Z`,
    delaySeconds: 0,
  });
  const board = (count: number): StationBoard => ({
    stationCode: '60000',
    stationName: 'Madrid Atocha',
    departures: Array.from({ length: count }, (_, i) => entry(i + 1)),
    arrivals: [],
  });

  it('lists the name and the next 3 departures in Madrid time', () => {
    const c = stationOgContent(board(5));
    expect(c.stationName).toBe('Madrid Atocha');
    expect(c.departures.map((d) => d.trainNumber)).toEqual(['01', '02', '03']);
    expect(c.departures[0]).toMatchObject({ time: '02:00', badge: 'on_time' });
  });
});
