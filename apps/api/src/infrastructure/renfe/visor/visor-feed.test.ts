import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Delay } from '../../../domain/movement/index.js';
import { createDelay, createRunId } from '../../../domain/movement/index.js';
import type { ScheduledRun } from '../../../domain/network/index.js';
import type { ScheduledRunLookup } from '../gtfs-rt/gtfs-rt-common.js';
import { RenfeVisorFeed } from './visor-feed.js';

const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(join(import.meta.dirname, '../../../../test/fixtures/2026-10-31', name)),
  );
const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

const scheduled = (trainNumber: string): ScheduledRun => ({
  tripId: `trip-${trainNumber}`,
  trainNumber,
  lineCode: 'AVE-X',
  serviceType: 'ave',
  serviceId: 's1',
});
/** Knows every long-distance Run; knows no Cercanías trip id. */
const timetable: ScheduledRunLookup = {
  findScheduledRunsByTripIds: async () => [],
  findScheduledRuns: async (trainNumber) => [scheduled(trainNumber)],
};

function feed(overrides: { timetable?: ScheduledRunLookup } = {}) {
  const onSkipped = vi.fn();
  const visor = new RenfeVisorFeed({
    timetable: overrides.timetable ?? timetable,
    onSkipped,
    now: () => new Date('2026-10-31T22:36:00Z'),
  });
  return { visor, onSkipped };
}

describe('RenfeVisorFeed fleet, long distance', () => {
  it('turns every train of flotaLD.json into a visor_ld Sighting', async () => {
    const { visor, onSkipped } = feed();
    const { sightings } = await visor.readFleet('larga-distancia', fixture('flotaLD.json'));

    expect(sightings).toHaveLength(16);
    expect(onSkipped).not.toHaveBeenCalled();
    const stopped = sightings.find((s) => s.runId.trainNumber === '15064');
    expect(stopped).toMatchObject({
      runId: createRunId('15064', '2026-10-31'),
      source: 'visor_ld',
      observedAt: new Date(1793486112 * 1000),
      lat: 41.39203,
      lon: 2.1646564,
      status: 'STOPPED_AT',
      stationCode: '71802',
      platform: '4',
      positionIsSnapped: false,
    });
    expect(sightings.find((s) => s.runId.trainNumber === '13073')).toMatchObject({
      status: 'IN_TRANSIT_TO',
      stationCode: '51409',
    });
  });

  it('reads ultRetraso minutes as Delay seconds towards the next Station', async () => {
    const { visor } = feed();
    const { delays } = await visor.readFleet('larga-distancia', fixture('flotaLD.json'));
    expect(delays.find((d) => d.runId.trainNumber === '15064')).toEqual({
      runId: createRunId('15064', '2026-10-31'),
      source: 'visor_ld',
      observedAt: new Date(1793486112 * 1000),
      seconds: 18 * 60,
      atStationCode: '71802',
    });
  });

  it('puts the Rolling stock and accessibility on the Run, typed from the timetable', async () => {
    const { visor } = feed();
    const { runs } = await visor.readFleet('larga-distancia', fixture('flotaLD.json'));
    expect(runs.find((r) => r.id.trainNumber === '15064')).toEqual({
      id: createRunId('15064', '2026-10-31'),
      serviceType: 'ave',
      lineCode: 'AVE-X',
      wheelchairAccessible: false,
      rollingStock: '470119',
    });
  });

  it('still yields Sightings and Delays, but no Run, for trains missing from the timetable', async () => {
    const { visor } = feed({
      timetable: { findScheduledRunsByTripIds: async () => [], findScheduledRuns: async () => [] },
    });
    const fleet = await visor.readFleet('larga-distancia', fixture('flotaLD.json'));
    expect(fleet.runs).toEqual([]);
    expect(fleet.sightings).toHaveLength(16);
    expect(fleet.delays).toHaveLength(16);
  });
});

describe('RenfeVisorFeed fleet, Cercanías', () => {
  const cercaniasTimetable: ScheduledRunLookup = {
    findScheduledRuns: async () => [],
    findScheduledRunsByTripIds: async (tripIds) =>
      tripIds.includes('3003S35574C1')
        ? [
            {
              tripId: '3003S35574C1',
              trainNumber: '23574',
              lineCode: 'C1',
              serviceType: 'cercanias',
              serviceId: 's1',
            },
          ]
        : [],
  };

  it('turns flota.json trains into visor_cercanias Sightings, Delays and Runs', async () => {
    const { visor, onSkipped } = feed({ timetable: cercaniasTimetable });
    const fleet = await visor.readFleet('cercanias', fixture('flota.json'));

    expect(fleet.sightings).toHaveLength(112);
    expect(onSkipped).not.toHaveBeenCalled();
    const observedAt = new Date('2026-10-31T22:35:17Z');
    expect(fleet.sightings.find((s) => s.runId.trainNumber === '23574')).toMatchObject({
      runId: createRunId('23574', '2026-10-31'),
      source: 'visor_cercanias',
      observedAt,
      status: 'IN_TRANSIT_TO',
      stationCode: '51200',
      positionIsSnapped: false,
    });
    expect(fleet.delays.find((d) => d.runId.trainNumber === '23574')).toMatchObject({
      source: 'visor_cercanias',
      seconds: 7 * 60,
      observedAt,
    });
    expect(fleet.runs).toEqual([
      {
        id: createRunId('23574', '2026-10-31'),
        serviceType: 'cercanias',
        lineCode: 'C1',
        wheelchairAccessible: false,
      },
    ]);
  });

  it('does not invent a Run for trains the timetable does not know', async () => {
    const { visor } = feed({ timetable: cercaniasTimetable });
    const { runs, sightings } = await visor.readFleet('cercanias', fixture('flota.json'));
    expect(sightings).toHaveLength(112);
    expect(runs).toHaveLength(1);
  });

  it('reports a train that is at a platform as stopped at its current Station', async () => {
    const { visor } = feed();
    const { sightings } = await visor.readFleet('cercanias', fixture('flota.json'));
    expect(sightings.find((s) => s.runId.trainNumber === '23578')).toMatchObject({
      status: 'STOPPED_AT',
      stationCode: '50600',
      platform: '4',
    });
  });
});

describe('RenfeVisorFeed schema drift', () => {
  const train = {
    codComercial: '15064',
    codEstAnt: '71802',
    codEstSig: '71802',
    ultRetraso: '18',
    latitud: 41.39,
    longitud: 2.16,
    time: 1793486112,
  };
  const body = (...trains: object[]) =>
    json({ fechaActualizacion: '2026-10-31T23:35:12', trenes: trains });

  it('skips, with a warning, a train missing a required field and keeps the others', async () => {
    const { visor, onSkipped } = feed();
    const { codComercial: _omitted, ...noNumber } = train;
    const { latitud: _lat, ...noLat } = { ...train, codComercial: '15065' };

    const { sightings } = await visor.readFleet(
      'larga-distancia',
      body(noNumber, noLat, { ...train, codComercial: '15066' }),
    );

    expect(sightings.map((s) => s.runId.trainNumber)).toEqual(['15066']);
    expect(onSkipped).toHaveBeenCalledTimes(2);
    expect(onSkipped).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining('latitud') }),
    );
  });

  it('skips a train with a malformed delay or position', async () => {
    const { visor, onSkipped } = feed();
    const { sightings } = await visor.readFleet(
      'larga-distancia',
      body({ ...train, ultRetraso: 'mucho' }, { ...train, codComercial: '2', latitud: 200 }),
    );
    expect(sightings).toEqual([]);
    expect(onSkipped).toHaveBeenCalledTimes(2);
  });

  it('keeps a train with no Delay reading, without a Delay', async () => {
    const { visor } = feed();
    const { ultRetraso: _delay, ...noDelay } = train;
    const fleet = await visor.readFleet('larga-distancia', body(noDelay));
    expect(fleet.sightings).toHaveLength(1);
    expect(fleet.delays).toEqual([]);
  });

  it('rejects a body that is not a visor file', async () => {
    const { visor } = feed();
    await expect(visor.readFleet('larga-distancia', json({ trenes: 'nope' }))).rejects.toThrow(
      /visor/i,
    );
    await expect(
      visor.readFleet('larga-distancia', new TextEncoder().encode('<html>')),
    ).rejects.toThrow(/visor/i);
  });
});

describe('RenfeVisorFeed stop estimates', () => {
  const runId = createRunId('13073', '2026-10-31');
  const delay = (seconds: number, id = runId): Delay =>
    createDelay({
      runId: id,
      source: 'visor_ld',
      observedAt: new Date('2026-10-31T22:35:00Z'),
      seconds,
    });

  it('adds the Delay to the scheduled times of every Station of the journey', async () => {
    const { visor } = feed();
    const estimates = await visor.readStopEstimates(fixture('trenesConEstacionesLD.json'), [
      delay(7 * 60),
    ]);

    expect(estimates).toHaveLength(13);
    expect(estimates[0]).toEqual({
      runId,
      sequence: 0,
      stationCode: '51003',
      scheduledArrival: new Date('2026-10-31T21:00:00Z'),
      scheduledDeparture: new Date('2026-10-31T21:00:00Z'),
      estimatedArrival: new Date('2026-10-31T21:07:00Z'),
      estimatedDeparture: new Date('2026-10-31T21:07:00Z'),
    });
    expect(estimates[12]).toMatchObject({ sequence: 12, stationCode: '51405' });
  });

  it('leaves out, silently, trains that have no Delay', async () => {
    const { visor, onSkipped } = feed();
    const estimates = await visor.readStopEstimates(fixture('trenesConEstacionesLD.json'), [
      delay(60),
    ]);
    expect(new Set(estimates.map((e) => e.runId.trainNumber))).toEqual(new Set(['13073']));
    expect(onSkipped).not.toHaveBeenCalled();
  });

  it('moves times past midnight to the next day', async () => {
    const { visor } = feed();
    const estimates = await visor.readStopEstimates(
      json({
        fechaActualizacion: '2026-10-31T23:35:12',
        trenes: [
          {
            idTren: '13073',
            estaciones: [
              { p: 'A', h: '23:50', hs: '23:52' },
              { p: 'B', h: '00:10', hs: '00:11' },
            ],
          },
        ],
      }),
      [delay(0)],
    );
    expect(estimates[1]?.scheduledArrival).toEqual(new Date('2026-10-31T23:10:00Z'));
    expect(estimates[1]?.scheduledArrival.getTime()).toBeGreaterThan(
      estimates[0]?.scheduledDeparture.getTime() ?? 0,
    );
  });

  it('skips a Station with missing or malformed times and keeps the rest of the journey', async () => {
    const { visor, onSkipped } = feed();
    const estimates = await visor.readStopEstimates(
      json({
        fechaActualizacion: '2026-10-31T23:35:12',
        trenes: [
          {
            idTren: '13073',
            estaciones: [
              { p: 'A', h: '22:00', hs: '22:01' },
              { p: 'B', h: 'xx' },
              { p: 'C', h: '22:30', hs: '22:31' },
            ],
          },
        ],
      }),
      [delay(0)],
    );
    expect(estimates.map((e) => e.stationCode)).toEqual(['A', 'C']);
    expect(onSkipped).toHaveBeenCalledTimes(1);
  });
});
