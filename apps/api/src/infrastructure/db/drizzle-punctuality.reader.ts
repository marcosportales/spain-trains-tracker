import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  type HourDelayTotals,
  type LineDelayTotals,
  type LineRunTotals,
  PunctualityReader,
} from '../../application/punctuality/punctuality.reader.js';
import type { ServiceType } from '../../domain/network/index.js';
import { DB } from './db.module.js';

interface LineRow extends Record<string, unknown> {
  line_code: string;
  name: string;
  service_type: string;
  hub_code: string | null;
  observations: string | number;
  total_seconds: string | number;
  on_time_observations: string | number;
}

interface RunTotalsRow extends Record<string, unknown> {
  line_code: string;
  name: string;
  service_type: string;
  hub_code: string | null;
  runs: string | number;
  on_time_runs: string | number;
  total_final_seconds: string | number;
}

interface HourRow extends Record<string, unknown> {
  hour: number;
  observations: string | number;
  total_seconds: string | number;
  on_time_observations: string | number;
}

@Injectable()
export class DrizzlePunctualityReader extends PunctualityReader {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async lineTotals(since: Date): Promise<LineDelayTotals[]> {
    // Sums of bigints come back as strings from Postgres.
    const rows = await this.db.execute<LineRow>(sql`
      SELECT s.line_code, l.name, s.service_type, s.hub_code,
        sum(s.observations) AS observations,
        sum(s.total_seconds) AS total_seconds,
        sum(s.on_time_observations) AS on_time_observations
      FROM delay_stats_hourly s
      JOIN lines l ON l.code = s.line_code
      WHERE s.bucket >= ${since.toISOString()}::timestamptz
      GROUP BY s.line_code, l.name, s.service_type, s.hub_code`);
    return rows.map((row) => ({
      lineCode: row.line_code,
      name: row.name,
      serviceType: row.service_type as ServiceType,
      ...(row.hub_code !== null && { hubCode: row.hub_code }),
      observations: Number(row.observations),
      totalSeconds: Number(row.total_seconds),
      onTimeObservations: Number(row.on_time_observations),
    }));
  }

  async lineRunTotals(sinceServiceDate: string): Promise<LineRunTotals[]> {
    // One row per Run: a Run that crosses midnight has two day buckets, the latest observation wins.
    // Bigint sums and counts come back as strings from Postgres.
    const rows = await this.db.execute<RunTotalsRow>(sql`
      WITH finals AS (
        SELECT DISTINCT ON (train_number, service_date)
          train_number, service_date, final_seconds
        FROM run_final_delays
        WHERE service_date >= ${sinceServiceDate}::date
        ORDER BY train_number, service_date, last_observed_at DESC
      )
      SELECT r.line_code, l.name, l.service_type, l.hub_code,
        count(*) AS runs,
        count(*) FILTER (WHERE f.final_seconds < 300) AS on_time_runs,
        sum(f.final_seconds) AS total_final_seconds
      FROM finals f
      JOIN runs r ON r.train_number = f.train_number AND r.service_date = f.service_date
      JOIN lines l ON l.code = r.line_code
      WHERE r.status IS DISTINCT FROM 'cancelled' AND r.line_code IS NOT NULL
      GROUP BY r.line_code, l.name, l.service_type, l.hub_code`);
    return rows.map((row) => ({
      lineCode: row.line_code,
      name: row.name,
      serviceType: row.service_type as ServiceType,
      ...(row.hub_code !== null && { hubCode: row.hub_code }),
      runs: Number(row.runs),
      onTimeRuns: Number(row.on_time_runs),
      totalFinalSeconds: Number(row.total_final_seconds),
    }));
  }

  async hourTotals(since: Date, lineCode?: string): Promise<HourDelayTotals[]> {
    const lineFilter = lineCode === undefined ? sql`` : sql`AND line_code = ${lineCode}`;
    const rows = await this.db.execute<HourRow>(sql`
      SELECT extract(hour FROM bucket AT TIME ZONE 'Europe/Madrid')::int AS hour,
        sum(observations) AS observations,
        sum(total_seconds) AS total_seconds,
        sum(on_time_observations) AS on_time_observations
      FROM delay_stats_hourly
      WHERE bucket >= ${since.toISOString()}::timestamptz ${lineFilter}
      GROUP BY 1`);
    return rows.map((row) => ({
      hour: row.hour,
      observations: Number(row.observations),
      totalSeconds: Number(row.total_seconds),
      onTimeObservations: Number(row.on_time_observations),
    }));
  }
}
