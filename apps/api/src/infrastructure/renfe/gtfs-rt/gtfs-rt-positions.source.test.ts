import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import gtfsRealtime from 'gtfs-realtime-bindings';
import { describe, expect, it } from 'vitest';
import type { ScheduledRun } from '../../../domain/network/index.js';
import { GtfsRtPositionsSource, type ScheduledRunLookup } from './gtfs-rt-positions.source.js';

const { transit_realtime: rt } = gtfsRealtime;
const FIXTURES = join(import.meta.dirname, '../../../../test/fixtures/2026-10-31');
const fixture = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)));

const NOW = new Date('2026-10-31T22:40:00Z');

function scheduledRun(tripId: string, trainNumber: string): ScheduledRun {
  return {
    tripId,
    trainNumber,
    lineCode: 'X',
    serviceType: 'cercanias',
    serviceId: 'S',
  };
}

/** A timetable that knows the given runs on every date, or on the listed dates only. */
function timetable(runs: ScheduledRun[], operatesOn?: string[]): ScheduledRunLookup {
  return {
    findScheduledRunsByTripIds: async (tripIds) => runs.filter((r) => tripIds.includes(r.tripId)),
    findScheduledRuns: async (trainNumber, serviceDate) =>
      runs.filter(
        (r) => r.trainNumber === trainNumber && (!operatesOn || operatesOn.includes(serviceDate)),
      ),
  };
}

function respond(body: Uint8Array, headers: Record<string, string> = {}): typeof fetch {
  return async () => new Response(body, { status: 200, headers });
}

function feedOf(
  entities: gtfsRealtime.transit_realtime.IFeedEntity[],
  headerTimestamp?: number,
): Uint8Array {
  return rt.FeedMessage.encode(
    rt.FeedMessage.create({
      header: {
        gtfsRealtimeVersion: '2.0',
        ...(headerTimestamp && { timestamp: headerTimestamp }),
      },
      entity: entities,
    }),
  ).finish();
}

const vehicleEntity = (
  id: string,
  vehicle: gtfsRealtime.transit_realtime.IVehiclePosition,
): gtfsRealtime.transit_realtime.IFeedEntity => ({ id, vehicle });

describe('GtfsRtPositionsSource', () => {
  it('decodes every Cercanías fixture entity into a Sighting from gtfsrt_cercanias', async () => {
    const source = new GtfsRtPositionsSource({
      timetable: timetable([]),
      fetch: respond(fixture('vehicle_positions.pb')),
      now: () => NOW,
    });

    const sightings = await source.fetchSightings('cercanias');

    expect(sightings).toHaveLength(114);
    expect(new Set(sightings.map((s) => s.source))).toEqual(new Set(['gtfsrt_cercanias']));
    expect(sightings[0]).toMatchObject({
      runId: { trainNumber: '23578', serviceDate: '2026-10-31' },
      status: 'INCOMING_AT',
      stationCode: '50600',
      platform: '4',
      positionIsSnapped: true,
      observedAt: new Date(1793486111 * 1000),
    });
    expect(sightings[0]?.lat).toBeCloseTo(37.661293, 5);
    expect(sightings[0]?.lon).toBeCloseTo(-5.531023, 5);
  });

  it('decodes every Larga Distancia fixture entity into a Sighting from gtfsrt_ld', async () => {
    const source = new GtfsRtPositionsSource({
      timetable: timetable([]),
      fetch: respond(fixture('vehicle_positions_LD.pb'), {
        'Last-Modified': 'Sat, 31 Oct 2026 22:35:00 GMT',
      }),
      now: () => NOW,
    });

    const sightings = await source.fetchSightings('larga-distancia');

    expect(sightings).toHaveLength(16);
    expect(new Set(sightings.map((s) => s.source))).toEqual(new Set(['gtfsrt_ld']));
    expect(sightings[0]).toMatchObject({
      runId: { trainNumber: '15064', serviceDate: '2026-10-31' },
      status: 'STOPPED_AT',
      stationCode: '79400',
    });
  });

  it('resolves the Run from the scheduled run of the trimmed tripId, before the label', async () => {
    const bytes = feedOf([
      vehicleEntity('VP_1', {
        trip: { tripId: ' 3003S23578C1 ' },
        position: { latitude: 40, longitude: -3 },
        currentStatus: rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO,
        timestamp: 1793486111,
        vehicle: { id: '1', label: 'C1-99999' },
      }),
    ]);
    const source = new GtfsRtPositionsSource({
      timetable: timetable([scheduledRun('3003S23578C1', '23578')]),
      fetch: respond(bytes),
      now: () => NOW,
    });

    const [sighting] = await source.fetchSightings('cercanias');

    expect(sighting?.runId).toEqual({ trainNumber: '23578', serviceDate: '2026-10-31' });
  });

  it('falls back to the label train number when the tripId is not scheduled', async () => {
    const bytes = feedOf([
      vehicleEntity('VP_1', {
        trip: { tripId: 'UNKNOWN' },
        position: { latitude: 40, longitude: -3 },
        currentStatus: rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO,
        timestamp: 1793486111,
        vehicle: { id: '1', label: 'C1-23578-PLATF.(4)' },
      }),
    ]);
    const source = new GtfsRtPositionsSource({
      timetable: timetable([]),
      fetch: respond(bytes),
      now: () => NOW,
    });

    const [sighting] = await source.fetchSightings('cercanias');

    expect(sighting?.runId.trainNumber).toBe('23578');
    expect(sighting?.platform).toBe('4');
  });

  it('keeps entities without a position as Sightings without lat/lon', async () => {
    const bytes = feedOf([
      vehicleEntity('VP_1', {
        trip: { tripId: 'T' },
        currentStatus: rt.VehiclePosition.VehicleStopStatus.STOPPED_AT,
        timestamp: 1793486111,
        stopId: '50600',
        vehicle: { id: '1', label: 'C1-23578' },
      }),
    ]);
    const source = new GtfsRtPositionsSource({
      timetable: timetable([]),
      fetch: respond(bytes),
      now: () => NOW,
    });

    const sightings = await source.fetchSightings('cercanias');

    expect(sightings).toHaveLength(1);
    expect(sightings[0]?.lat).toBeUndefined();
    expect(sightings[0]?.lon).toBeUndefined();
    expect(sightings[0]?.stationCode).toBe('50600');
  });

  it('reports and skips entities whose Run cannot be identified', async () => {
    const bytes = feedOf([
      vehicleEntity('VP_NOPE', {
        trip: { tripId: 'UNKNOWN' },
        position: { latitude: 40, longitude: -3 },
        timestamp: 1793486111,
        vehicle: { id: '1', label: 'garbage' },
      }),
    ]);
    const skipped: string[] = [];
    const source = new GtfsRtPositionsSource({
      timetable: timetable([]),
      fetch: respond(bytes),
      now: () => NOW,
      onSkipped: (problem) => skipped.push(problem.entityId),
    });

    expect(await source.fetchSightings('cercanias')).toEqual([]);
    expect(skipped).toEqual(['VP_NOPE']);
  });

  describe('observedAt', () => {
    const noTimestamp = (): Uint8Array =>
      feedOf(
        [
          vehicleEntity('VP_1', {
            trip: { tripId: 'T' },
            position: { latitude: 40, longitude: -3 },
            currentStatus: rt.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO,
            vehicle: { id: '1', label: '15064' },
          }),
        ],
        1793482512, // the LD header timestamp, about an hour off
      );

    it('uses the HTTP Last-Modified on LD when the entity has no timestamp, ignoring the header', async () => {
      const source = new GtfsRtPositionsSource({
        timetable: timetable([]),
        fetch: respond(noTimestamp(), { 'Last-Modified': 'Sat, 31 Oct 2026 22:35:00 GMT' }),
        now: () => NOW,
      });

      const [sighting] = await source.fetchSightings('larga-distancia');

      expect(sighting?.observedAt).toEqual(new Date('2026-10-31T22:35:00Z'));
    });

    it('uses the entity timestamp on LD when present', async () => {
      const bytes = feedOf([
        vehicleEntity('VP_1', {
          trip: { tripId: 'T' },
          timestamp: 1793486111,
          vehicle: { id: '1', label: '15064' },
        }),
      ]);
      const source = new GtfsRtPositionsSource({
        timetable: timetable([]),
        fetch: respond(bytes, { 'Last-Modified': 'Sat, 31 Oct 2026 22:35:00 GMT' }),
        now: () => NOW,
      });

      const [sighting] = await source.fetchSightings('larga-distancia');

      expect(sighting?.observedAt).toEqual(new Date(1793486111 * 1000));
    });

    it('falls back to the fetch time on LD when there is no Last-Modified either', async () => {
      const source = new GtfsRtPositionsSource({
        timetable: timetable([]),
        fetch: respond(noTimestamp()),
        now: () => NOW,
      });

      const [sighting] = await source.fetchSightings('larga-distancia');

      expect(sighting?.observedAt).toEqual(NOW);
    });

    it('uses the header timestamp on Cercanías when the entity has no timestamp', async () => {
      const source = new GtfsRtPositionsSource({
        timetable: timetable([]),
        fetch: respond(noTimestamp(), { 'Last-Modified': 'Sat, 31 Oct 2026 22:35:00 GMT' }),
        now: () => NOW,
      });

      const [sighting] = await source.fetchSightings('cercanias');

      expect(sighting?.observedAt).toEqual(new Date(1793482512 * 1000));
    });
  });

  describe('Service date', () => {
    it('is the previous day for a scheduled Run seen after midnight', async () => {
      // 2026-11-01T00:30 Madrid (UTC+1) = 2026-10-31T23:30Z
      const seen = Date.parse('2026-10-31T23:30:00Z') / 1000;
      const bytes = feedOf([
        vehicleEntity('VP_1', {
          trip: { tripId: 'T1' },
          timestamp: seen,
          vehicle: { id: '1', label: 'C1-23578' },
        }),
      ]);
      const source = new GtfsRtPositionsSource({
        timetable: timetable([scheduledRun('T1', '23578')], ['2026-10-31']),
        fetch: respond(bytes),
        now: () => NOW,
      });

      const [sighting] = await source.fetchSightings('cercanias');

      expect(sighting?.runId.serviceDate).toBe('2026-10-31');
    });
  });

  it('fails when the feed request fails', async () => {
    const source = new GtfsRtPositionsSource({
      timetable: timetable([]),
      fetch: async () => new Response('', { status: 503 }),
      now: () => NOW,
    });

    await expect(source.fetchSightings('cercanias')).rejects.toThrow(/503/);
  });
});
