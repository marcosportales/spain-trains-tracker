import {
  classifyServiceType,
  createHub,
  createLine,
  createStation,
  type GtfsFeedKind,
  type Hub,
  hubCodeFromCercaniasId,
  hubNameFor,
  type Line,
  type ScheduledRun,
  type ScheduledStop,
  type ServiceCalendar,
  type ServiceType,
  type Station,
  type TrackGeometry,
} from '../../domain/network/index.js';
import type { StaticNetwork } from './network.repository.js';
import type { GtfsFeed } from './static-feeds.js';

export interface GtfsNetworkResult {
  readonly network: StaticNetwork;
  /** Stop times dropped because their stop is unknown or their Run was not kept. */
  readonly skippedStopTimes: number;
}

export interface GtfsNetworkContext {
  /** Stations already stored, by code. Their data wins; only new Service types and hubs are merged in. */
  readonly knownStations: ReadonlyMap<string, Station>;
  /** Codes of Stations served only by metre-gauge trains (from the stations CSV). */
  readonly metreGaugeStationCodes: ReadonlySet<string>;
}

/** Turns one GTFS feed into the static network it describes. */
export async function buildGtfsNetwork(
  feed: GtfsFeed,
  kind: GtfsFeedKind,
  context: GtfsNetworkContext,
): Promise<GtfsNetworkResult> {
  const routes = new Map<string, { shortName: string; color?: string; hubCode?: string }>();
  for await (const route of feed.rows('routes')) {
    const color = /^[0-9A-Fa-f]{6}$/.test(route.route_color ?? '') ? route.route_color : undefined;
    const hubCode = kind === 'cercanias' ? knownHubCode(route.route_id) : undefined;
    routes.set(route.route_id, {
      shortName: route.route_short_name || route.route_id,
      ...(color !== undefined && { color }),
      ...(hubCode !== undefined && { hubCode }),
    });
  }

  const calendars = await readCalendars(feed);

  const trips = new Map<string, TripDraft>();
  for await (const trip of feed.rows('trips')) {
    const route = routes.get(trip.route_id);
    if (!route) continue;
    trips.set(trip.trip_id, {
      tripId: trip.trip_id,
      routeId: trip.route_id,
      serviceId: trip.service_id,
      trainNumber: trainNumberOf(kind, trip.trip_id, trip.trip_short_name),
      ...(trip.shape_id !== undefined && trip.shape_id !== '' && { shapeId: trip.shape_id }),
    });
  }

  const stopRows = new Map<
    string,
    { name: string; lat: number; lon: number; wheelchair?: boolean }
  >();
  for await (const stop of feed.rows('stops')) {
    stopRows.set(stop.stop_id, {
      name: stop.stop_name,
      lat: stop.stop_lat,
      lon: stop.stop_lon,
      ...(stop.wheelchair_boarding !== undefined &&
        stop.wheelchair_boarding !== 0 && { wheelchair: stop.wheelchair_boarding === 1 }),
    });
  }

  const stops: ScheduledStop[] = [];
  const routeStationCodes = new Map<string, Set<string>>();
  let skippedStopTimes = 0;
  for await (const stopTime of feed.rows('stop_times')) {
    const trip = trips.get(stopTime.trip_id);
    const known = context.knownStations.has(stopTime.stop_id) || stopRows.has(stopTime.stop_id);
    if (!trip || !known) {
      skippedStopTimes++;
      continue;
    }
    stops.push({
      tripId: stopTime.trip_id,
      sequence: stopTime.stop_sequence,
      stationCode: stopTime.stop_id,
      arrivalSeconds: parseGtfsTime(stopTime.arrival_time),
      departureSeconds: parseGtfsTime(stopTime.departure_time),
    });
    const codes = getOrCreate(routeStationCodes, trip.routeId, () => new Set());
    codes.add(stopTime.stop_id);
  }

  // Lines and Service types, one Line per short name (and Hub).
  const lines = new Map<string, Line>();
  const routeLines = new Map<string, { line: Line; serviceType: ServiceType }>();
  for (const [routeId, route] of routes) {
    const codes = routeStationCodes.get(routeId);
    const onlyMetreGaugeStations =
      codes !== undefined &&
      codes.size > 0 &&
      [...codes].every((code) => context.metreGaugeStationCodes.has(code));
    const serviceType = classifyServiceType({
      feed: kind,
      shortName: route.shortName,
      onlyMetreGaugeStations,
    });
    const hubName = route.hubCode === undefined ? undefined : hubNameFor(route.hubCode);
    const code =
      route.hubCode === undefined ? route.shortName : `${route.hubCode}-${route.shortName}`;
    let line = lines.get(code);
    if (!line) {
      line = createLine({
        code,
        name: hubName === undefined ? route.shortName : `${route.shortName} ${hubName}`,
        serviceType,
        ...(route.hubCode !== undefined && { hubCode: route.hubCode }),
        ...(route.color !== undefined && { color: route.color }),
      });
      lines.set(code, line);
    }
    routeLines.set(routeId, { line, serviceType });
  }

  const runs: ScheduledRun[] = [];
  const stationTypes = new Map<string, Set<ServiceType>>();
  const stationHubs = new Map<string, string>();
  const shapeLines = new Map<string, string>();
  for (const trip of trips.values()) {
    const resolved = routeLines.get(trip.routeId);
    if (!resolved) continue;
    runs.push({
      tripId: trip.tripId,
      trainNumber: trip.trainNumber,
      lineCode: resolved.line.code,
      serviceType: resolved.serviceType,
      serviceId: trip.serviceId,
      ...(trip.shapeId !== undefined && { shapeId: trip.shapeId }),
    });
    if (trip.shapeId !== undefined && !shapeLines.has(trip.shapeId)) {
      shapeLines.set(trip.shapeId, resolved.line.code);
    }
  }
  const lineByRoute = new Map([...routeLines].map(([id, r]) => [id, r]));
  for (const [routeId, codes] of routeStationCodes) {
    const resolved = lineByRoute.get(routeId);
    if (!resolved) continue;
    for (const code of codes) {
      const types = getOrCreate(stationTypes, code, () => new Set());
      types.add(resolved.serviceType);
      if (resolved.line.hubCode !== undefined && !stationHubs.has(code)) {
        stationHubs.set(code, resolved.line.hubCode);
      }
    }
  }

  // Only calendars that some Run uses; trips reference them by service_id.
  const usedServiceIds = new Set(runs.map((run) => run.serviceId));
  const serviceCalendars = [...calendars.values()].filter((c) => usedServiceIds.has(c.serviceId));
  const calendarIds = new Set(serviceCalendars.map((c) => c.serviceId));
  const keptRuns = runs.filter((run) => calendarIds.has(run.serviceId));
  const keptTripIds = new Set(keptRuns.map((run) => run.tripId));
  const keptStops = stops.filter((stop) => keptTripIds.has(stop.tripId));

  const stations: Station[] = [];
  for (const code of new Set(keptStops.map((stop) => stop.stationCode))) {
    const known = context.knownStations.get(code);
    const row = stopRows.get(code);
    const types = [...(stationTypes.get(code) ?? [])];
    const hubCode = known?.hubCode ?? stationHubs.get(code);
    if (known) {
      const merged = [...new Set([...known.serviceTypes, ...types])];
      if (
        merged.length === known.serviceTypes.length &&
        (hubCode ?? '') === (known.hubCode ?? '')
      ) {
        continue;
      }
      stations.push(createStation({ ...known, serviceTypes: merged, ...(hubCode && { hubCode }) }));
    } else if (row) {
      stations.push(
        createStation({
          code,
          name: row.name,
          lat: row.lat,
          lon: row.lon,
          serviceTypes: types,
          ...(hubCode !== undefined && { hubCode }),
          ...(row.wheelchair !== undefined && { wheelchairBoarding: row.wheelchair }),
        }),
      );
    }
  }

  const hubCodes = new Set<string>();
  for (const line of lines.values()) if (line.hubCode) hubCodes.add(line.hubCode);
  for (const station of stations) if (station.hubCode) hubCodes.add(station.hubCode);
  const hubs: Hub[] = [...hubCodes].map((code) => createHub(code));

  const geometries = await readGeometries(feed, shapeLines);
  // A Run may only point at a shape that was stored.
  const storedShapes = new Set(geometries.map((geometry) => geometry.shapeId));
  const finalRuns = keptRuns.map(({ shapeId, ...run }) =>
    shapeId !== undefined && storedShapes.has(shapeId) ? { ...run, shapeId } : run,
  );

  return {
    network: {
      hubs,
      stations,
      lines: [...lines.values()],
      calendars: serviceCalendars,
      runs: finalRuns,
      stops: keptStops,
      geometries,
    },
    skippedStopTimes,
  };
}

interface TripDraft {
  readonly tripId: string;
  readonly routeId: string;
  readonly serviceId: string;
  readonly trainNumber: string;
  readonly shapeId?: string;
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}

function knownHubCode(routeId: string): string | undefined {
  const code = hubCodeFromCercaniasId(routeId);
  return code !== undefined && hubNameFor(code) !== undefined ? code : undefined;
}

/**
 * The Train number of a trip. Larga distancia trips carry it in `trip_short_name`. Cercanías trip
 * ids are `<service id, 4 digits + letter><5-digit train number><line>` (`3003S23578C1`).
 */
function trainNumberOf(kind: GtfsFeedKind, tripId: string, shortName: string | undefined): string {
  if (shortName) return shortName;
  if (kind === 'cercanias') {
    const match = /^\d{4}[A-Z](\d{5})/.exec(tripId);
    if (match?.[1]) return match[1];
  }
  return tripId;
}

export function parseGtfsTime(time: string): number {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0);
}

function isoDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

async function readCalendars(feed: GtfsFeed): Promise<Map<string, ServiceCalendar>> {
  const exceptions = new Map<string, { date: string; added: boolean }[]>();
  for await (const row of feed.rows('calendar_dates')) {
    const list = getOrCreate(exceptions, row.service_id, () => []);
    list.push({ date: isoDate(row.date), added: row.exception_type === 1 });
  }
  const calendars = new Map<string, ServiceCalendar>();
  for await (const row of feed.rows('calendar')) {
    calendars.set(row.service_id, {
      serviceId: row.service_id,
      weekdays: [
        row.monday,
        row.tuesday,
        row.wednesday,
        row.thursday,
        row.friday,
        row.saturday,
        row.sunday,
      ],
      startDate: isoDate(row.start_date),
      endDate: isoDate(row.end_date),
      exceptions: exceptions.get(row.service_id) ?? [],
    });
  }
  return calendars;
}

async function readGeometries(
  feed: GtfsFeed,
  shapeLines: ReadonlyMap<string, string>,
): Promise<TrackGeometry[]> {
  const points = new Map<string, { sequence: number; lon: number; lat: number }[]>();
  for await (const row of feed.rows('shapes')) {
    if (!shapeLines.has(row.shape_id)) continue;
    const list = getOrCreate(points, row.shape_id, () => []);
    list.push({ sequence: row.shape_pt_sequence, lon: row.shape_pt_lon, lat: row.shape_pt_lat });
  }
  const geometries: TrackGeometry[] = [];
  for (const [shapeId, list] of points) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.sequence - b.sequence);
    geometries.push({
      shapeId,
      lineCode: shapeLines.get(shapeId) as string,
      path: list.map((p) => [p.lon, p.lat] as const),
    });
  }
  return geometries;
}
