import { Inject, Injectable } from '@nestjs/common';
import type { LineSearchHit, RunSearchHit, StationSearchHit } from '@stt/contracts';
import { type SQL, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { SearchReader } from '../../application/search/search.reader.js';
import type { ServiceType } from '../../domain/network/index.js';
import { DB } from './db.module.js';
import * as t from './schema/index.js';

/** Escapes `%`, `_` and `\` so user input matches literally in LIKE. */
const likeEscape = (value: string) => value.replace(/[\\%_]/g, '\\$&');

/** Name in the form the trigram indexes hold: lowercase, without accents. */
const folded = (column: unknown) => sql`stt_unaccent(lower(${column}))`;

/** A search value folded the same way as `folded` columns. */
const foldedValue = (value: string) => sql`stt_unaccent(lower(${value}))`;

/** Station names scoring below this word similarity to the query are not typo matches. */
const TYPO_SIMILARITY_THRESHOLD = 0.4;

@Injectable()
export class DrizzleSearchReader extends SearchReader {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async findRuns(query: string, since: Date, limit: number): Promise<RunSearchHit[]> {
    return this.queryRuns(
      sql`r.train_number LIKE ${`${likeEscape(query)}%`}
        AND r.last_seen_at >= ${since.toISOString()}::timestamptz
      ORDER BY (r.train_number = ${query}) DESC, r.service_date DESC, r.train_number`,
      limit,
    );
  }

  async findMostDelayedRuns(since: Date, limit: number): Promise<RunSearchHit[]> {
    return this.queryRuns(
      sql`r.last_seen_at >= ${since.toISOString()}::timestamptz
      ORDER BY (
        SELECT dl.seconds FROM ${t.delays} dl
        WHERE dl.train_number = r.train_number AND dl.service_date = r.service_date
        ORDER BY dl.observed_at DESC LIMIT 1
      ) DESC NULLS LAST, r.last_seen_at DESC, r.train_number`,
      limit,
    );
  }

  /** Runs with origin and destination names, from a WHERE condition plus ORDER BY. */
  private async queryRuns(whereAndOrder: SQL, limit: number): Promise<RunSearchHit[]> {
    const rows = await this.db.execute<{
      train_number: string;
      service_date: string;
      service_type: string;
      line_code: string | null;
      origin_name: string | null;
      destination_name: string | null;
    }>(sql`
      SELECT r.train_number, r.service_date::text AS service_date, r.service_type, r.line_code,
        o.name AS origin_name, d.name AS destination_name
      FROM ${t.runs} r
      LEFT JOIN ${t.stations} o ON o.code = r.origin_station_code
      LEFT JOIN ${t.stations} d ON d.code = r.destination_station_code
      WHERE ${whereAndOrder}
      LIMIT ${limit}`);
    return rows.map((row) => ({
      trainNumber: row.train_number,
      serviceDate: row.service_date,
      serviceType: row.service_type as ServiceType,
      ...(row.line_code !== null && { lineCode: row.line_code }),
      ...(row.origin_name !== null && { originName: row.origin_name }),
      ...(row.destination_name !== null && { destinationName: row.destination_name }),
    }));
  }

  async findStations(query: string, limit: number): Promise<StationSearchHit[]> {
    const needle = foldedValue(query);
    const literal = foldedValue(likeEscape(query));
    const rows = await this.db.execute<{ code: string; name: string }>(sql`
      SELECT code, name
      FROM ${t.stations}
      WHERE ${folded(t.stations.name)} LIKE '%' || ${literal} || '%'
        OR public.word_similarity(${needle}, ${folded(t.stations.name)}) >= ${TYPO_SIMILARITY_THRESHOLD}
      ORDER BY
        (${folded(t.stations.name)} LIKE ${literal} || '%') DESC,
        public.word_similarity(${needle}, ${folded(t.stations.name)}) DESC,
        name
      LIMIT ${limit}`);
    return rows.map((row) => ({ stationCode: row.code, name: row.name }));
  }

  async findLines(query: string, limit: number): Promise<LineSearchHit[]> {
    const prefix = sql`${foldedValue(likeEscape(query))} || '%'`;
    const needle = foldedValue(query);
    const rows = await this.db.execute<{ code: string; name: string; service_type: string }>(sql`
      SELECT code, name, service_type
      FROM ${t.lines}
      WHERE ${folded(t.lines.name)} LIKE ${prefix} OR lower(code) LIKE ${prefix}
      ORDER BY (${folded(t.lines.name)} = ${needle}) DESC, name, code
      LIMIT ${limit}`);
    return rows.map((row) => ({
      lineCode: row.code,
      name: row.name,
      serviceType: row.service_type as ServiceType,
    }));
  }
}
