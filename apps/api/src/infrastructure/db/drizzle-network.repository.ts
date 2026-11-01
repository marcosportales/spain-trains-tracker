import { Inject, Injectable } from '@nestjs/common';
import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  NetworkRepository,
  type StaticNetwork,
} from '../../application/network/network.repository.js';
import type {
  Hub,
  Line,
  ScheduledRun,
  ScheduledStop,
  ServiceType,
  StaticImport,
  Station,
  TrackGeometry,
} from '../../domain/network/index.js';
import { DB } from './db.module.js';
import * as t from './schema/index.js';

/** Keeps each INSERT well under Postgres' 65 535 bind-parameter limit. */
const BATCH_SIZE = 2_000;

const DEFAULT_SIMPLIFY_METERS = 5;
const METERS_PER_DEGREE = 111_320;

type Tx = Parameters<Parameters<PostgresJsDatabase['transaction']>[0]>[0];

const point = (lat: number, lon: number) => `SRID=4326;POINT(${lon} ${lat})`;
const lineString = (path: TrackGeometry['path']) =>
  `SRID=4326;LINESTRING(${path.map(([lon, lat]) => `${lon} ${lat}`).join(',')})`;
const geog = (ewkt: string) => sql`ST_GeogFromText(${ewkt})`;

@Injectable()
export class DrizzleNetworkRepository extends NetworkRepository {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async saveStaticNetwork(network: StaticNetwork, record: StaticImport): Promise<void> {
    await this.db.transaction(async (tx) => {
      await upsert(tx, t.hubs, network.hubs, t.hubs.code, (h) => ({ code: h.code, name: h.name }), {
        name: sql`excluded.name`,
      });
      await upsert(
        tx,
        t.stations,
        network.stations,
        t.stations.code,
        (s) => ({
          code: s.code,
          name: s.name,
          location: geog(point(s.lat, s.lon)) as unknown as string,
          hubCode: s.hubCode ?? null,
          serviceTypes: [...s.serviceTypes],
          wheelchairBoarding: s.wheelchairBoarding ?? null,
        }),
        {
          name: sql`excluded.name`,
          location: sql`excluded.location`,
          hubCode: sql`excluded.hub_code`,
          serviceTypes: sql`excluded.service_types`,
          wheelchairBoarding: sql`excluded.wheelchair_boarding`,
        },
      );
      await upsert(
        tx,
        t.lines,
        network.lines,
        t.lines.code,
        (l) => ({
          code: l.code,
          name: l.name,
          serviceType: l.serviceType,
          hubCode: l.hubCode ?? null,
          color: l.color ?? null,
        }),
        {
          name: sql`excluded.name`,
          serviceType: sql`excluded.service_type`,
          hubCode: sql`excluded.hub_code`,
          color: sql`excluded.color`,
        },
      );
      await upsert(
        tx,
        t.serviceCalendars,
        network.calendars,
        t.serviceCalendars.serviceId,
        (c) => ({
          serviceId: c.serviceId,
          monday: c.weekdays[0],
          tuesday: c.weekdays[1],
          wednesday: c.weekdays[2],
          thursday: c.weekdays[3],
          friday: c.weekdays[4],
          saturday: c.weekdays[5],
          sunday: c.weekdays[6],
          startDate: c.startDate,
          endDate: c.endDate,
        }),
        {
          monday: sql`excluded.monday`,
          tuesday: sql`excluded.tuesday`,
          wednesday: sql`excluded.wednesday`,
          thursday: sql`excluded.thursday`,
          friday: sql`excluded.friday`,
          saturday: sql`excluded.saturday`,
          sunday: sql`excluded.sunday`,
          startDate: sql`excluded.start_date`,
          endDate: sql`excluded.end_date`,
        },
      );
      // Exceptions are replaced wholesale for the calendars being imported.
      for (const batch of chunks(network.calendars)) {
        await tx.delete(t.serviceCalendarDates).where(
          sql`${t.serviceCalendarDates.serviceId} IN (${sql.join(
            batch.map((c) => sql`${c.serviceId}`),
            sql`, `,
          )})`,
        );
      }
      await insertAll(
        tx,
        t.serviceCalendarDates,
        network.calendars.flatMap((c) =>
          c.exceptions.map((e) => ({ serviceId: c.serviceId, date: e.date, added: e.added })),
        ),
      );
      await upsert(
        tx,
        t.trackGeometries,
        network.geometries,
        t.trackGeometries.shapeId,
        (g) => ({
          shapeId: g.shapeId,
          lineCode: g.lineCode ?? null,
          geometry: geog(lineString(g.path)) as unknown as string,
        }),
        { lineCode: sql`excluded.line_code`, geometry: sql`excluded.geometry` },
      );
      await upsert(
        tx,
        t.scheduledRuns,
        network.runs,
        t.scheduledRuns.tripId,
        (r) => ({
          tripId: r.tripId,
          trainNumber: r.trainNumber,
          lineCode: r.lineCode,
          serviceType: r.serviceType,
          serviceId: r.serviceId,
          shapeId: r.shapeId ?? null,
        }),
        {
          trainNumber: sql`excluded.train_number`,
          lineCode: sql`excluded.line_code`,
          serviceType: sql`excluded.service_type`,
          serviceId: sql`excluded.service_id`,
          shapeId: sql`excluded.shape_id`,
        },
      );
      await upsert(
        tx,
        t.scheduledStops,
        network.stops,
        [t.scheduledStops.tripId, t.scheduledStops.sequence],
        (s) => ({ ...s }),
        {
          stationCode: sql`excluded.station_code`,
          arrivalSeconds: sql`excluded.arrival_seconds`,
          departureSeconds: sql`excluded.departure_seconds`,
        },
      );
      await tx.insert(t.staticImports).values({
        source: record.source,
        etag: record.etag ?? null,
        importedAt: record.importedAt,
      });
    });
  }

  async lastStaticImport(source: string): Promise<StaticImport | undefined> {
    const [row] = await this.db
      .select()
      .from(t.staticImports)
      .where(eq(t.staticImports.source, source))
      .orderBy(desc(t.staticImports.importedAt), desc(t.staticImports.id))
      .limit(1);
    return (
      row && {
        source: row.source,
        importedAt: row.importedAt,
        ...(row.etag !== null && { etag: row.etag }),
      }
    );
  }

  listHubs(): Promise<Hub[]> {
    return this.db.select().from(t.hubs).orderBy(asc(t.hubs.code));
  }

  async listLines(): Promise<Line[]> {
    const rows = await this.db.select().from(t.lines).orderBy(asc(t.lines.code));
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      serviceType: r.serviceType as ServiceType,
      ...(r.hubCode !== null && { hubCode: r.hubCode }),
      ...(r.color !== null && { color: r.color }),
    }));
  }

  listStations(): Promise<Station[]> {
    return this.selectStations(sql`true`, sql`code`);
  }

  async findStation(code: string): Promise<Station | undefined> {
    return (await this.selectStations(sql`code = ${code}`, sql`code`))[0];
  }

  findStationsNear(lat: number, lon: number, radiusMeters: number): Promise<Station[]> {
    const origin = geog(point(lat, lon));
    return this.selectStations(
      sql`ST_DWithin(location, ${origin}, ${radiusMeters})`,
      sql`ST_Distance(location, ${origin}), code`,
    );
  }

  private async selectStations(where: ReturnType<typeof sql>, order: ReturnType<typeof sql>) {
    const rows = await this.db.execute<{
      code: string;
      name: string;
      lat: number;
      lon: number;
      hub_code: string | null;
      service_types: string[];
      wheelchair_boarding: boolean | null;
    }>(sql`
      SELECT code, name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon,
             hub_code, service_types, wheelchair_boarding
      FROM ${t.stations} WHERE ${where} ORDER BY ${order}`);
    return rows.map(
      (r): Station => ({
        code: r.code,
        name: r.name,
        lat: r.lat,
        lon: r.lon,
        serviceTypes: r.service_types as ServiceType[],
        ...(r.hub_code !== null && { hubCode: r.hub_code }),
        ...(r.wheelchair_boarding !== null && { wheelchairBoarding: r.wheelchair_boarding }),
      }),
    );
  }

  async findScheduledRunsByTripIds(tripIds: readonly string[]): Promise<ScheduledRun[]> {
    if (tripIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(t.scheduledRuns)
      .where(inArray(t.scheduledRuns.tripId, [...tripIds]));
    return rows.map((r) => ({
      tripId: r.tripId,
      trainNumber: r.trainNumber,
      lineCode: r.lineCode,
      serviceType: r.serviceType as ServiceType,
      serviceId: r.serviceId,
      ...(r.shapeId !== null && { shapeId: r.shapeId }),
    }));
  }

  async findScheduledRuns(trainNumber: string, serviceDate: string): Promise<ScheduledRun[]> {
    const rows = await this.db.execute<{
      trip_id: string;
      train_number: string;
      line_code: string;
      service_type: string;
      service_id: string;
      shape_id: string | null;
    }>(sql`
      SELECT r.trip_id, r.train_number, r.line_code, r.service_type, r.service_id, r.shape_id
      FROM ${t.scheduledRuns} r
      JOIN ${t.serviceCalendars} c ON c.service_id = r.service_id
      LEFT JOIN ${t.serviceCalendarDates} e
        ON e.service_id = r.service_id AND e.date = ${serviceDate}::date
      WHERE r.train_number = ${trainNumber}
        AND CASE
          WHEN e.added IS NOT NULL THEN e.added
          ELSE ${serviceDate}::date BETWEEN c.start_date AND c.end_date
            AND CASE extract(isodow FROM ${serviceDate}::date)::int
              WHEN 1 THEN c.monday WHEN 2 THEN c.tuesday WHEN 3 THEN c.wednesday
              WHEN 4 THEN c.thursday WHEN 5 THEN c.friday WHEN 6 THEN c.saturday
              ELSE c.sunday END
        END
      ORDER BY r.trip_id`);
    return rows.map((r) => ({
      tripId: r.trip_id,
      trainNumber: r.train_number,
      lineCode: r.line_code,
      serviceType: r.service_type as ServiceType,
      serviceId: r.service_id,
      ...(r.shape_id !== null && { shapeId: r.shape_id }),
    }));
  }

  getScheduledStops(tripId: string): Promise<ScheduledStop[]> {
    return this.db
      .select()
      .from(t.scheduledStops)
      .where(eq(t.scheduledStops.tripId, tripId))
      .orderBy(asc(t.scheduledStops.sequence));
  }

  async getTrackGeometry(shapeId: string): Promise<TrackGeometry | undefined> {
    const [row] = await this.db.execute<{ line_code: string | null; geojson: string }>(sql`
      SELECT line_code, ST_AsGeoJSON(geometry::geometry) AS geojson
      FROM ${t.trackGeometries} WHERE shape_id = ${shapeId}`);
    if (!row) return undefined;
    const { coordinates } = JSON.parse(row.geojson) as { coordinates: [number, number][] };
    return {
      shapeId,
      path: coordinates,
      ...(row.line_code !== null && { lineCode: row.line_code }),
    };
  }

  trackGeometryFor(lineCode: string): Promise<TrackGeometry[]> {
    return this.selectLineGeometries(lineCode, sql`geometry::geometry`);
  }

  simplifiedTrackGeometryFor(
    lineCode: string,
    toleranceMeters = DEFAULT_SIMPLIFY_METERS,
  ): Promise<TrackGeometry[]> {
    // ST_Simplify works in the units of the geometry (degrees for SRID 4326), so the tolerance is
    // converted from metres at the equatorial scale. That is exact for latitude and
    // conservative for longitude (never removes more than asked).
    const degrees = toleranceMeters / METERS_PER_DEGREE;
    return this.selectLineGeometries(
      lineCode,
      sql`ST_Simplify(geometry::geometry, ${degrees}, true)`,
    );
  }

  private async selectLineGeometries(
    lineCode: string,
    geometry: ReturnType<typeof sql>,
  ): Promise<TrackGeometry[]> {
    const rows = await this.db.execute<{ shape_id: string; geojson: string }>(sql`
      SELECT shape_id, ST_AsGeoJSON(${geometry}) AS geojson
      FROM ${t.trackGeometries} WHERE line_code = ${lineCode} ORDER BY shape_id`);
    return rows.map((row) => ({
      shapeId: row.shape_id,
      lineCode,
      path: (JSON.parse(row.geojson) as { coordinates: [number, number][] }).coordinates,
    }));
  }
}

function* chunks<T>(items: readonly T[]): Generator<T[]> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) yield items.slice(i, i + BATCH_SIZE);
}

async function insertAll(tx: Tx, table: PgTable, rows: readonly object[]) {
  for (const batch of chunks(rows)) await tx.insert(table).values(batch as never);
}

async function upsert<I, R extends object>(
  tx: Tx,
  table: PgTable,
  items: readonly I[],
  target: PgColumn | PgColumn[],
  toRow: (item: I) => R,
  set: Record<string, unknown>,
) {
  for (const batch of chunks(items)) {
    await tx
      .insert(table)
      .values(batch.map(toRow) as never)
      .onConflictDoUpdate({ target, set: set as never });
  }
}
