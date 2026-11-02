import type {
  LiveRun,
  RunDetail,
  SearchResult,
  StationBoard,
  StationList,
  TrackFeatureCollection,
} from '@stt/contracts';
import { SPAIN_VIEW } from '../src/components/map/map-config.js';

export const WEB_PORT = 4310;
export const MOCK_API_PORT = 4311;

/** Fixed Service date: the mock API never reads the clock, so the tests are deterministic. */
export const SERVICE_DATE = '2026-11-01';

export const STATION_CODE = '60000';
export const STATION_NAME = 'Madrid Puerta de Atocha';

/** Sits exactly on the initial map centre, so the tests can find its marker without projecting. */
export const RUN: LiveRun = {
  trainNumber: '03063',
  serviceDate: SERVICE_DATE,
  serviceType: 'ave',
  lineCode: 'AVE-MAD-SEV',
  lon: SPAIN_VIEW.center[0],
  lat: SPAIN_VIEW.center[1],
  status: 'in_transit_to',
  delaySeconds: 300,
  nextStationCode: '51003',
  sources: ['official'],
  observedAt: `${SERVICE_DATE}T10:00:00+01:00`,
};

export const RUN_DETAIL: RunDetail = {
  run: {
    trainNumber: RUN.trainNumber,
    serviceDate: RUN.serviceDate,
    serviceType: RUN.serviceType,
    ...(RUN.lineCode !== undefined && { lineCode: RUN.lineCode }),
  },
  position: {
    lat: RUN.lat,
    lon: RUN.lon,
    status: RUN.status,
    ...(RUN.nextStationCode !== undefined && { nextStationCode: RUN.nextStationCode }),
    sources: RUN.sources,
    observedAt: RUN.observedAt,
  },
  originStationCode: STATION_CODE,
  destinationStationCode: '51003',
  serviceStatus: 'scheduled',
  stops: [
    {
      stationCode: STATION_CODE,
      sequence: 0,
      scheduledDeparture: `${SERVICE_DATE}T09:30:00+01:00`,
    },
    {
      stationCode: '51003',
      sequence: 1,
      scheduledArrival: `${SERVICE_DATE}T11:45:00+01:00`,
    },
  ],
  delaySeconds: 300,
};

export const STATIONS: StationList = [
  { code: STATION_CODE, name: STATION_NAME, lat: 40.406, lon: -3.69 },
  { code: '51003', name: 'Sevilla-Santa Justa', lat: 37.392, lon: -5.975 },
];

export const STATION_BOARD: StationBoard = {
  stationCode: STATION_CODE,
  stationName: STATION_NAME,
  departures: [
    {
      trainNumber: RUN.trainNumber,
      serviceDate: SERVICE_DATE,
      serviceType: 'ave',
      lineCode: RUN.lineCode as string,
      counterpartStationCode: '51003',
      scheduledAt: `${SERVICE_DATE}T09:30:00+01:00`,
      estimatedAt: `${SERVICE_DATE}T09:35:00+01:00`,
      delaySeconds: 300,
    },
  ],
  arrivals: [],
};

export const NO_TRACK: TrackFeatureCollection = { type: 'FeatureCollection', features: [] };

export function search(query: string): SearchResult {
  const hit = STATIONS.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));
  return {
    query,
    runs: [],
    lines: [],
    stations: hit.map((s) => ({ stationCode: s.code, name: s.name })),
  };
}
