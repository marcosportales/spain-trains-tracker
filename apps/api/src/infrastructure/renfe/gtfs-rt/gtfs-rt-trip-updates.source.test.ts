import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import gtfsRealtime from 'gtfs-realtime-bindings';
import { describe, expect, it } from 'vitest';
import type { ScheduledRun } from '../../../domain/network/index.js';
import type { ScheduledRunLookup } from './gtfs-rt-common.js';
import { GtfsRtTripUpdatesSource } from './gtfs-rt-trip-updates.source.js';

const { transit_realtime: rt } = gtfsRealtime;
const FIXTURES = join(import.meta.dirname, '../../../../test/fixtures/2026-10-31');
const fixture = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)));

const NOW = new Date('2026-10-31T22:40:00Z');
const HEADER = 1793486116;

function scheduledRun(
  tripId: string,
  trainNumber: string,
  serviceType: ScheduledRun['serviceType'] = 'cercanias',
): ScheduledRun {
  return { tripId, trainNumber, lineCode: 'X', serviceType, serviceId: 'S' };
}

function timetable(runs: ScheduledRun[]): ScheduledRunLookup {
  return {
    findScheduledRunsByTripIds: async (tripIds) => runs.filter((r) => tripIds.includes(r.tripId)),
    findScheduledRuns: async (trainNumber) => runs.filter((r) => r.trainNumber === trainNumber),
  };
}

function respond(body: Uint8Array, headers: Record<string, string> = {}): typeof fetch {
  return async () => new Response(body, { status: 200, headers });
}

function feedOf(entities: gtfsRealtime.transit_realtime.IFeedEntity[]): Uint8Array {
  return rt.FeedMessage.encode(
    rt.FeedMessage.create({
      header: { gtfsRealtimeVersion: '2.0', timestamp: HEADER },
      entity: entities,
    }),
  ).finish();
}

const tripEntity = (
  id: string,
  tripUpdate: gtfsRealtime.transit_realtime.ITripUpdate,
): gtfsRealtime.transit_realtime.IFeedEntity => ({ id, tripUpdate });

describe('GtfsRtTripUpdatesSource', () => {
  it('yields a Delay with integer seconds for every Cercanías fixture entity', async () => {
    const source = new GtfsRtTripUpdatesSource({
      timetable: timetable([]),
      fetch: respond(fixture('trip_updates.pb')),
      now: () => NOW,
    });

    const { delays, runs } = await source.fetchTripUpdates('cercanias');

    expect(delays).toHaveLength(114);
    expect(delays.every((d) => Number.isInteger(d.seconds))).toBe(true);
    expect(new Set(delays.map((d) => d.source))).toEqual(new Set(['gtfsrt_cercanias']));
    expect(delays[0]).toMatchObject({
      runId: { trainNumber: '23578', serviceDate: '2026-10-31' },
      seconds: 0,
      atStationCode: '50602',
      observedAt: new Date(HEADER * 1000),
    });
    expect(runs).toHaveLength(114);
    expect(runs[0]).toMatchObject({
      id: { trainNumber: '23578', serviceDate: '2026-10-31' },
      serviceType: 'cercanias',
      status: 'scheduled',
      wheelchairAccessible: false,
    });
    expect(runs.filter((r) => r.wheelchairAccessible === true)).toHaveLength(1);
    expect(runs.filter((r) => r.wheelchairAccessible === undefined)).toHaveLength(29);
  });

  it('yields a Delay for every running LD entity, identifying the Run from the tripId', async () => {
    const source = new GtfsRtTripUpdatesSource({
      timetable: timetable([]),
      fetch: respond(fixture('trip_updates_LD.pb'), {
        'Last-Modified': 'Sat, 31 Oct 2026 22:35:00 GMT',
      }),
      now: () => NOW,
    });

    const { delays } = await source.fetchTripUpdates('larga-distancia');

    expect(delays).toHaveLength(20);
    expect(new Set(delays.map((d) => d.source))).toEqual(new Set(['gtfsrt_ld']));
    expect(delays[0]).toMatchObject({
      runId: { trainNumber: '01181', serviceDate: '2026-10-30' },
      seconds: 420,
      atStationCode: '60911',
      observedAt: new Date('2026-10-31T22:35:00Z'),
    });
  });

  it('surfaces CANCELED trips as cancelled Runs without a Delay', async () => {
    const bytes = feedOf([
      tripEntity('TUCANCEL_1', {
        trip: {
          tripId: '0029712026-10-31',
          scheduleRelationship: rt.TripDescriptor.ScheduleRelationship.CANCELED,
        },
      }),
    ]);
    const source = new GtfsRtTripUpdatesSource({
      timetable: timetable([scheduledRun('0029712026-10-31', '00297', 'ave')]),
      fetch: respond(bytes),
      now: () => NOW,
    });

    const { delays, runs } = await source.fetchTripUpdates('larga-distancia');

    expect(delays).toEqual([]);
    expect(runs).toEqual([
      {
        id: { trainNumber: '00297', serviceDate: '2026-10-31' },
        serviceType: 'ave',
        lineCode: 'X',
        status: 'cancelled',
      },
    ]);
  });

  it('uses the scheduled Run of the tripId and the first stop update as next station', async () => {
    const bytes = feedOf([
      tripEntity('TU_1', {
        trip: { tripId: ' 3003S23578C1 ' },
        delay: -60,
        timestamp: 1793486000,
        stopTimeUpdate: [{ stopId: '111' }, { stopId: '222' }],
      }),
    ]);
    const source = new GtfsRtTripUpdatesSource({
      timetable: timetable([scheduledRun('3003S23578C1', '99999')]),
      fetch: respond(bytes),
      now: () => NOW,
    });

    const { delays } = await source.fetchTripUpdates('cercanias');

    expect(delays).toHaveLength(1);
    expect(delays[0]).toMatchObject({
      runId: { trainNumber: '99999', serviceDate: '2026-10-31' },
      seconds: -60,
      atStationCode: '111',
      observedAt: new Date(1793486000 * 1000),
    });
  });

  it('skips entities whose Run cannot be identified or that carry no delay', async () => {
    const bytes = feedOf([
      tripEntity('TU_NOID', { trip: { tripId: 'WEIRD' }, delay: 5 }),
      tripEntity('TU_NODELAY', { trip: { tripId: '3003S23578C1' } }),
    ]);
    const skipped: string[] = [];
    const source = new GtfsRtTripUpdatesSource({
      timetable: timetable([]),
      fetch: respond(bytes),
      now: () => NOW,
      onSkipped: (p) => skipped.push(p.entityId),
    });

    const { delays } = await source.fetchTripUpdates('cercanias');

    expect(delays).toEqual([]);
    expect(skipped).toEqual(['TU_NOID', 'TU_NODELAY']);
  });

  it('rejects when the feed responds with an error', async () => {
    const source = new GtfsRtTripUpdatesSource({
      timetable: timetable([]),
      fetch: async () => new Response('x', { status: 503 }),
    });

    await expect(source.fetchTripUpdates('cercanias')).rejects.toThrow('503');
  });
});
