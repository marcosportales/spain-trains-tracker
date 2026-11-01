import { Inject, Injectable } from '@nestjs/common';
import type { WindowSighting } from '@stt/contracts';
import { type SQL, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  type SightingWindowQuery,
  SightingWindowReader,
} from '../../application/sighting-window/sighting-window.reader.js';
import { DB } from './db.module.js';

interface SightingRow extends Record<string, unknown> {
  train_number: string;
  service_date: string;
  source: WindowSighting['source'];
  observed_at: Date | string;
  lat: number;
  lon: number;
  status: WindowSighting['status'];
  station_code: string | null;
  platform: string | null;
  position_is_snapped: boolean;
}

@Injectable()
export class DrizzleSightingWindowReader extends SightingWindowReader {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async sightings(query: SightingWindowQuery): Promise<WindowSighting[]> {
    const trainFilter: SQL =
      query.trainNumber !== undefined ? sql`AND train_number = ${query.trainNumber}` : sql``;
    // The earliest Sighting of each Run and Source in every `stepSeconds` bucket of time.
    const rows = await this.db.execute<SightingRow>(sql`
      SELECT train_number, service_date, source, observed_at, lat, lon, status,
        station_code, platform, position_is_snapped
      FROM (
        SELECT DISTINCT ON (train_number, service_date, source, bucket)
          train_number, service_date::text AS service_date, source, observed_at,
          lat, lon, status, station_code, platform, position_is_snapped
        FROM (
          SELECT *, floor(extract(epoch FROM observed_at) / ${query.stepSeconds}::int) AS bucket
          FROM sightings
          WHERE observed_at >= ${query.from.toISOString()}::timestamptz
            AND observed_at < ${query.to.toISOString()}::timestamptz
            AND lat IS NOT NULL AND lon IS NOT NULL
            ${trainFilter}
        ) AS bucketed
        ORDER BY train_number, service_date, source, bucket, observed_at
      ) AS sampled
      ORDER BY observed_at, train_number`);
    return rows.map((row) => ({
      trainNumber: row.train_number,
      serviceDate: row.service_date,
      source: row.source,
      observedAt: new Date(row.observed_at).toISOString(),
      lat: row.lat,
      lon: row.lon,
      status: row.status,
      ...(row.station_code !== null ? { stationCode: row.station_code } : {}),
      ...(row.platform !== null ? { platform: row.platform } : {}),
      positionIsSnapped: row.position_is_snapped,
    }));
  }
}
