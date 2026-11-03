import type {
  DelayByHour,
  LiveRun,
  PunctualityRanking,
  RunDetail,
  SearchResult,
  SightingWindow,
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

/** An active Service alert affecting two Lines. */
export const ALERT = {
  id: 'alert-1',
  lineCodes: ['C1', 'C5'],
  header: 'Reduced service',
  description: 'Works between Atocha and Chamartín.',
  activeFrom: '2026-07-01T10:05:00Z',
};

export const PUNCTUALITY_LINE = { code: 'C-3', name: 'Cercanías Madrid C-3' };

export const PUNCTUALITY_RANKING: PunctualityRanking = {
  days: 7,
  overall: { runs: 400, onTimePct: 87 },
  lines: [
    {
      lineCode: PUNCTUALITY_LINE.code,
      name: PUNCTUALITY_LINE.name,
      serviceType: 'cercanias',
      runs: 400,
      onTimePct: 87,
      avgSeconds: 240,
    },
  ],
};

/** Delays peak at 8:00 and 9:00; the other hours run on time. */
export const DELAY_BY_HOUR: DelayByHour = {
  days: 7,
  hours: Array.from({ length: 24 }, (_, hour) => {
    const peak = hour === 8 || hour === 9;
    return { hour, observations: 20, avgSeconds: peak ? 420 : 60, onTimePct: peak ? 50 : 95 };
  }),
};

/** The Replay window starting at `from`: empty for the last full hour, one Sighting for the hour before it. */
export function sightingWindow(from: Date, now = new Date()): SightingWindow {
  const lastFull = new Date(now);
  lastFull.setUTCMinutes(0, 0, 0);
  const withData = lastFull.getTime() - 2 * 3_600_000;
  const observedAt = new Date(from.getTime() + 60_000).toISOString();
  return {
    from: from.toISOString(),
    to: new Date(from.getTime() + 3_600_000).toISOString(),
    stepSeconds: 60,
    sightings:
      from.getTime() === withData
        ? [
            {
              trainNumber: RUN.trainNumber,
              serviceDate: RUN.serviceDate,
              source: 'official',
              observedAt,
              lat: RUN.lat,
              lon: RUN.lon,
              status: RUN.status,
              positionIsSnapped: false,
            },
          ]
        : [],
  };
}
