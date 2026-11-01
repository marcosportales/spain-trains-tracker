import { RunDetail } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  createDelay,
  createRunId,
  createRunStopEstimate,
  createSighting,
} from '../../domain/movement/index.js';
import type { ScheduledRun, ScheduledStop } from '../../domain/network/index.js';
import type { NetworkRepository } from '../network/network.repository.js';
import { GetRunDetail, RunNotFoundError } from './get-run-detail.use-case.js';
import type { RunDetailReader, StoredRunDetail } from './run-detail.reader.js';

const runId = createRunId('3063', '2026-10-31');
const lastSeenAt = new Date('2026-10-31T10:00:00Z');

const sighting = createSighting({
  runId,
  source: 'gtfsrt_ld',
  observedAt: new Date('2026-10-31T10:00:00Z'),
  lat: 40.4,
  lon: -3.7,
  status: 'IN_TRANSIT_TO',
  stationCode: '51003',
});

function stored(overrides: Partial<StoredRunDetail> = {}): StoredRunDetail {
  return {
    run: { id: runId, serviceType: 'ave', lineCode: 'AVE-MS', lastSeenAt },
    sightings: [sighting],
    stopEstimates: [],
    ...overrides,
  };
}

const scheduledRun: ScheduledRun = {
  tripId: 'trip-1',
  trainNumber: '03063',
  lineCode: 'AVE-MS',
  serviceType: 'ave',
  serviceId: 'svc',
};
// DST ended on 2026-10-25, so 2026-10-31 is CET (UTC+1): 08:00 local = 07:00Z.
const stops: ScheduledStop[] = [
  {
    tripId: 'trip-1',
    sequence: 0,
    stationCode: '60000',
    arrivalSeconds: 28_800,
    departureSeconds: 28_800,
  },
  {
    tripId: 'trip-1',
    sequence: 1,
    stationCode: '51003',
    arrivalSeconds: 36_000,
    departureSeconds: 36_300,
  },
  {
    tripId: 'trip-1',
    sequence: 2,
    stationCode: '71801',
    arrivalSeconds: 90_000,
    departureSeconds: 90_000,
  },
];

const network = (runs: ScheduledRun[] = [scheduledRun], s: ScheduledStop[] = stops) =>
  ({
    findScheduledRuns: async () => runs,
    getScheduledStops: async () => s,
  }) as unknown as NetworkRepository;

const useCase = (detail: StoredRunDetail | undefined, net = network()) =>
  new GetRunDetail({ findRunDetail: async () => detail } as RunDetailReader, net);

describe('GetRunDetail', () => {
  it('throws RunNotFoundError for an unknown Run', async () => {
    await expect(useCase(undefined).execute('03063', '2026-10-31')).rejects.toBeInstanceOf(
      RunNotFoundError,
    );
  });

  it('returns a RunDetail valid against the contract', async () => {
    const result = await useCase(
      stored({
        run: {
          id: runId,
          serviceType: 'ave',
          lineCode: 'AVE-MS',
          wheelchairAccessible: true,
          rollingStock: '449013',
          status: 'scheduled',
          lastSeenAt,
        },
      }),
    ).execute('03063', '2026-10-31');
    expect(RunDetail.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      run: {
        trainNumber: '03063',
        serviceDate: '2026-10-31',
        serviceType: 'ave',
        lineCode: 'AVE-MS',
        lat: 40.4,
        lon: -3.7,
        status: 'in_transit_to',
        nextStationCode: '51003',
        sources: ['official'],
        observedAt: '2026-10-31T10:00:00.000Z',
      },
      originStationCode: '60000',
      destinationStationCode: '71801',
      serviceStatus: 'scheduled',
      wheelchairAccessible: true,
      rollingStock: '449013',
    });
  });

  it('estimates stop times as the schedule plus the current Delay', async () => {
    const delay = createDelay({ runId, source: 'gtfsrt_ld', observedAt: lastSeenAt, seconds: 120 });
    const result = await useCase(stored({ delay })).execute('03063', '2026-10-31');
    expect(result.delaySeconds).toBe(120);
    expect(result.run.delaySeconds).toBe(120);
    expect(result.stops).toEqual([
      {
        stationCode: '60000',
        sequence: 0,
        scheduledArrival: '2026-10-31T07:00:00.000Z',
        scheduledDeparture: '2026-10-31T07:00:00.000Z',
        estimatedArrival: '2026-10-31T07:02:00.000Z',
        estimatedDeparture: '2026-10-31T07:02:00.000Z',
      },
      {
        stationCode: '51003',
        sequence: 1,
        scheduledArrival: '2026-10-31T09:00:00.000Z',
        scheduledDeparture: '2026-10-31T09:05:00.000Z',
        estimatedArrival: '2026-10-31T09:02:00.000Z',
        estimatedDeparture: '2026-10-31T09:07:00.000Z',
      },
      {
        stationCode: '71801',
        sequence: 2,
        // 25:00:00 runs past midnight into 2026-11-01: 01:00 local = 00:00Z.
        scheduledArrival: '2026-11-01T00:00:00.000Z',
        scheduledDeparture: '2026-11-01T00:00:00.000Z',
        estimatedArrival: '2026-11-01T00:02:00.000Z',
        estimatedDeparture: '2026-11-01T00:02:00.000Z',
      },
    ]);
  });

  it('gives no estimated times when the Delay is unknown', async () => {
    const result = await useCase(stored()).execute('03063', '2026-10-31');
    expect(result.delaySeconds).toBeUndefined();
    expect(result.stops[0]).toEqual({
      stationCode: '60000',
      sequence: 0,
      scheduledArrival: '2026-10-31T07:00:00.000Z',
      scheduledDeparture: '2026-10-31T07:00:00.000Z',
    });
  });

  it('prefers the Visor estimates over schedule plus Delay', async () => {
    const at = (iso: string) => new Date(iso);
    const stopEstimates = [
      createRunStopEstimate({
        runId,
        sequence: 0,
        stationCode: '60000',
        scheduledArrival: at('2026-10-31T06:00:00Z'),
        scheduledDeparture: at('2026-10-31T06:00:00Z'),
        estimatedArrival: at('2026-10-31T06:10:00Z'),
        estimatedDeparture: at('2026-10-31T06:10:00Z'),
      }),
      createRunStopEstimate({
        runId,
        sequence: 1,
        stationCode: '51003',
        scheduledArrival: at('2026-10-31T08:00:00Z'),
        scheduledDeparture: at('2026-10-31T08:05:00Z'),
        estimatedArrival: at('2026-10-31T08:11:00Z'),
        estimatedDeparture: at('2026-10-31T08:15:00Z'),
      }),
    ];
    const delay = createDelay({ runId, source: 'gtfsrt_ld', observedAt: lastSeenAt, seconds: 120 });
    const result = await useCase(stored({ delay, stopEstimates })).execute('03063', '2026-10-31');
    expect(result.stops).toEqual([
      {
        stationCode: '60000',
        sequence: 0,
        scheduledArrival: '2026-10-31T06:00:00.000Z',
        scheduledDeparture: '2026-10-31T06:00:00.000Z',
        estimatedArrival: '2026-10-31T06:10:00.000Z',
        estimatedDeparture: '2026-10-31T06:10:00.000Z',
      },
      {
        stationCode: '51003',
        sequence: 1,
        scheduledArrival: '2026-10-31T08:00:00.000Z',
        scheduledDeparture: '2026-10-31T08:05:00.000Z',
        estimatedArrival: '2026-10-31T08:11:00.000Z',
        estimatedDeparture: '2026-10-31T08:15:00.000Z',
      },
    ]);
    expect(result.originStationCode).toBe('60000');
    expect(result.destinationStationCode).toBe('51003');
  });

  it('returns no stops when the timetable does not know the Run', async () => {
    const result = await useCase(stored(), network([])).execute('03063', '2026-10-31');
    expect(result.stops).toEqual([]);
    expect(result.originStationCode).toBeUndefined();
  });

  it('picks the scheduled Run of the Run’s Line when several share the Train number', async () => {
    const other = { ...scheduledRun, tripId: 'trip-2', lineCode: 'OTHER' };
    const asked: string[] = [];
    const net = {
      findScheduledRuns: async () => [other, scheduledRun],
      getScheduledStops: async (tripId: string) => {
        asked.push(tripId);
        return stops;
      },
    } as unknown as NetworkRepository;
    await useCase(stored(), net).execute('03063', '2026-10-31');
    expect(asked).toEqual(['trip-1']);
  });

  it('throws RunNotFoundError when no Sighting has a position', async () => {
    const noFix = createSighting({
      runId,
      source: 'gtfsrt_ld',
      observedAt: lastSeenAt,
      status: 'IN_TRANSIT_TO',
    });
    await expect(
      useCase(stored({ sightings: [noFix] })).execute('03063', '2026-10-31'),
    ).rejects.toBeInstanceOf(RunNotFoundError);
  });
});
