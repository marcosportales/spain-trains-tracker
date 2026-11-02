import { describe, expect, it } from 'vitest';
import {
  DelayByHour,
  LineDto,
  LiveDiff,
  LiveSnapshot,
  PunctualityRanking,
  RunDetail,
  SearchResult,
  ServiceAlertDto,
  SightingWindow,
  StationBoard,
  TrainHistory,
} from './index.js';

const run = {
  trainNumber: '03063',
  serviceDate: '2026-10-31',
  serviceType: 'ave',
  lat: 40.4065,
  lon: -3.6892,
  status: 'in_transit_to',
  sources: ['official'],
  observedAt: '2026-10-31T10:15:30Z',
};

const rejects = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(schema.safeParse(v).success).toBe(false);

describe('LiveSnapshot', () => {
  const ok = { cycleId: 12, generatedAt: '2026-10-31T10:15:31Z', runs: [run] };
  it('accepts an example payload', () => expect(LiveSnapshot.parse(ok)).toEqual(ok));
  it('accepts an empty snapshot', () =>
    expect(LiveSnapshot.safeParse({ ...ok, runs: [] }).success).toBe(true));
  it('rejects a negative cycleId', () => rejects(LiveSnapshot, { ...ok, cycleId: -1 }));
  it('rejects an invalid Run', () => rejects(LiveSnapshot, { ...ok, runs: [{ ...run, lat: 99 }] }));
});

describe('LiveDiff', () => {
  const ok = {
    cycleId: 13,
    upserted: [run],
    removed: [{ trainNumber: '00010', serviceDate: '2026-10-31' }],
  };
  it('accepts an example payload', () => expect(LiveDiff.parse(ok)).toEqual(ok));
  it('rejects a bad RunId', () =>
    rejects(LiveDiff, { ...ok, removed: [{ trainNumber: 'x', serviceDate: '2026-10-31' }] }));
  it('rejects a missing cycleId', () => rejects(LiveDiff, { upserted: [], removed: [] }));
});

describe('RunDetail', () => {
  const identity = { trainNumber: '03063', serviceDate: '2026-10-31', serviceType: 'ave' };
  const { trainNumber: _t, serviceDate: _d, serviceType: _s, ...position } = run;
  const ok = {
    run: identity,
    position,
    delaySeconds: 120,
    rollingStock: 'S-103',
    stops: [
      {
        stationCode: '60000',
        sequence: 0,
        scheduledDeparture: '2026-10-31T10:00:00+01:00',
        estimatedDeparture: '2026-10-31T10:02:00+01:00',
      },
      {
        stationCode: '51003',
        sequence: 1,
        scheduledArrival: '2026-10-31T11:30:00+01:00',
      },
    ],
  };
  it('accepts an example payload', () => expect(RunDetail.parse(ok)).toEqual(ok));
  it('accepts a Run without Rolling stock or Delay', () =>
    expect(RunDetail.safeParse({ run: identity, stops: [] }).success).toBe(true));
  it('rejects a stop with an unzoned time', () =>
    rejects(RunDetail, {
      run: identity,
      stops: [{ stationCode: '1', sequence: 0, scheduledArrival: '2026-10-31T11:30:00' }],
    }));
  it('accepts a Scheduled Run: no position', () =>
    expect(RunDetail.safeParse({ run: identity, stops: [] }).success).toBe(true));
  it('rejects a position without coordinates', () =>
    rejects(RunDetail, { ...ok, position: { ...position, lat: undefined } }));
  it('rejects empty Rolling stock', () => rejects(RunDetail, { ...ok, rollingStock: '' }));
  it('accepts origin, destination, service status and accessibility', () => {
    const full = {
      ...ok,
      originStationCode: '60000',
      destinationStationCode: '51003',
      serviceStatus: 'cancelled',
      wheelchairAccessible: false,
    };
    expect(RunDetail.parse(full)).toEqual(full);
  });
  it('rejects an unknown service status', () =>
    rejects(RunDetail, { ...ok, serviceStatus: 'late' }));
});

describe('StationBoard', () => {
  const entry = {
    trainNumber: '03063',
    serviceDate: '2026-10-31',
    serviceType: 'ave',
    lineCode: 'AVE-MAD-SEV',
    counterpartStationCode: '51003',
    scheduledAt: '2026-10-31T10:00:00+01:00',
    estimatedAt: '2026-10-31T10:02:00+01:00',
    delaySeconds: 120,
  };
  const ok = {
    stationCode: '60000',
    stationName: 'Madrid Puerta de Atocha',
    departures: [entry],
    arrivals: [],
  };
  it('accepts an example payload', () => expect(StationBoard.parse(ok)).toEqual(ok));
  it('rejects an entry without scheduledAt', () =>
    rejects(StationBoard, { ...ok, departures: [{ ...entry, scheduledAt: undefined }] }));
  it('rejects an empty station name', () => rejects(StationBoard, { ...ok, stationName: '' }));
});

describe('SearchResult', () => {
  const ok = {
    query: 'atocha',
    runs: [{ trainNumber: '03063', serviceDate: '2026-10-31', serviceType: 'ave' }],
    stations: [{ stationCode: '60000', name: 'Madrid Puerta de Atocha' }],
    lines: [{ lineCode: 'C1', name: 'C1', serviceType: 'cercanias' }],
  };
  it('accepts an example payload', () => expect(SearchResult.parse(ok)).toEqual(ok));
  it('accepts no matches', () =>
    expect(
      SearchResult.safeParse({ query: 'zzz', runs: [], stations: [], lines: [] }).success,
    ).toBe(true));
  it('rejects an unknown service type in a line hit', () =>
    rejects(SearchResult, { ...ok, lines: [{ lineCode: 'C1', name: 'C1', serviceType: 'x' }] }));
});

describe('ServiceAlertDto', () => {
  const ok = {
    id: 'alert-1',
    lineCodes: ['C1', 'C2'],
    header: 'Obras entre Atocha y Chamartín',
    description: 'Servicio sustituido por autobús.',
    activeFrom: '2026-10-31T06:00:00+01:00',
    activeUntil: '2026-11-02T23:00:00+01:00',
  };
  it('accepts an example payload', () => expect(ServiceAlertDto.parse(ok)).toEqual(ok));
  it('rejects an alert affecting no Line', () =>
    rejects(ServiceAlertDto, { ...ok, lineCodes: [] }));
  it('rejects an empty header', () => rejects(ServiceAlertDto, { ...ok, header: '' }));
});

describe('LineDto', () => {
  const ok = {
    lineCode: 'C1',
    name: 'C1 Príncipe Pío – Aeropuerto T4',
    serviceType: 'cercanias',
    hubCode: 'madrid',
    track: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [-3.7197, 40.4212],
              [-3.6892, 40.4065],
            ],
          },
          properties: {},
        },
      ],
    },
  };
  it('accepts an example payload', () => expect(LineDto.parse(ok)).toEqual(ok));
  it('accepts a Line without Track geometry', () =>
    expect(
      LineDto.safeParse({ ...ok, track: { type: 'FeatureCollection', features: [] } }).success,
    ).toBe(true));
  it('rejects a one-point LineString', () =>
    rejects(LineDto, {
      ...ok,
      track: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[0, 0]] },
            properties: {},
          },
        ],
      },
    }));
  it('rejects out-of-range coordinates', () =>
    rejects(LineDto, {
      ...ok,
      track: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [200, 0],
              ],
            },
            properties: {},
          },
        ],
      },
    }));
  it('rejects a non-kebab hubCode', () => rejects(LineDto, { ...ok, hubCode: 'Madrid' }));
});

describe('PunctualityRanking', () => {
  const ok = {
    days: 7,
    overall: { runs: 120, onTimePct: 91.5 },
    lines: [
      {
        lineCode: 'C1',
        name: 'C1',
        serviceType: 'cercanias',
        hubCode: 'madrid',
        runs: 120,
        onTimePct: 91.5,
        avgSeconds: -20,
      },
    ],
  };
  it('accepts an example payload', () => expect(PunctualityRanking.parse(ok)).toEqual(ok));
  it('accepts an empty ranking with a null overall', () =>
    expect(PunctualityRanking.safeParse({ days: 7, overall: null, lines: [] }).success).toBe(true));
  it('rejects a ranking without overall', () =>
    rejects(PunctualityRanking, { days: 7, lines: [] }));
  it('rejects a Line without Runs', () =>
    rejects(PunctualityRanking, { ...ok, lines: [{ ...ok.lines[0], runs: 0 }] }));
  it('rejects an on-time share above 100', () =>
    rejects(PunctualityRanking, { ...ok, lines: [{ ...ok.lines[0], onTimePct: 101 }] }));
});

describe('DelayByHour', () => {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    observations: 0,
    avgSeconds: null,
    onTimePct: null,
  }));
  it('accepts 24 hours', () =>
    expect(DelayByHour.parse({ days: 7, lineCode: 'C1', hours })).toEqual({
      days: 7,
      lineCode: 'C1',
      hours,
    }));
  it('rejects fewer than 24 hours', () => rejects(DelayByHour, { days: 7, hours: hours.slice(1) }));
});

describe('TrainHistory', () => {
  const ok = {
    trainNumber: '03063',
    days: 30,
    summary: { runs: 2, typicalSeconds: 420, onTimePct: 50 },
    runs: [
      { serviceDate: '2026-10-31', observations: 12, avgSeconds: 600, maxSeconds: 900 },
      { serviceDate: '2026-10-30', observations: 9, avgSeconds: 240, maxSeconds: 300 },
    ],
  };
  it('accepts an example payload', () => expect(TrainHistory.parse(ok)).toEqual(ok));
  it('accepts no history', () =>
    expect(TrainHistory.safeParse({ trainNumber: '03063', days: 30, runs: [] }).success).toBe(
      true,
    ));
  it('rejects a malformed Train number', () =>
    rejects(TrainHistory, { ...ok, trainNumber: 'AVE' }));
  it('rejects an on-time share above 100', () =>
    rejects(TrainHistory, { ...ok, summary: { ...ok.summary, onTimePct: 101 } }));
});

describe('SightingWindow', () => {
  const ok = {
    from: '2026-10-31T08:00:00Z',
    to: '2026-10-31T09:00:00Z',
    stepSeconds: 60,
    sightings: [
      {
        trainNumber: '03063',
        serviceDate: '2026-10-31',
        source: 'official',
        observedAt: '2026-10-31T08:00:10Z',
        lat: 40.4,
        lon: -3.7,
        status: 'in_transit_to',
        stationCode: '60000',
        positionIsSnapped: false,
      },
    ],
  };
  it('accepts an example payload', () => expect(SightingWindow.parse(ok)).toEqual(ok));
  it('accepts an empty window', () =>
    expect(SightingWindow.safeParse({ ...ok, sightings: [] }).success).toBe(true));
  it('rejects a Sighting without a position', () =>
    rejects(SightingWindow, {
      ...ok,
      sightings: [{ ...ok.sightings[0], lat: undefined }],
    }));
  it('rejects a non-positive step', () => rejects(SightingWindow, { ...ok, stepSeconds: 0 }));
});
