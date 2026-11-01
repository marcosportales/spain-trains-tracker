import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  MovementRepository,
  type StoredRun,
} from '../../application/movement/movement.repository.js';
import {
  type ActivePeriod,
  createRun,
  createRunId,
  createRunStopEstimate,
  createServiceAlert,
  type Delay,
  type Run,
  type RunStopEstimate,
  type ServiceAlert,
  type Sighting,
  type Source,
} from '../../domain/movement/index.js';
import { DB } from './db.module.js';
import * as t from './schema/index.js';

/** Keeps each INSERT well under Postgres' 65 535 bind-parameter limit (10 columns per Sighting). */
const BATCH_SIZE = 5_000;

@Injectable()
export class DrizzleMovementRepository extends MovementRepository {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  saveSightings(sightings: readonly Sighting[]): Promise<number> {
    return this.insertIgnoringDuplicates(
      t.sightings,
      sightings.map((s) => ({
        trainNumber: s.runId.trainNumber,
        serviceDate: s.runId.serviceDate,
        source: s.source,
        observedAt: s.observedAt,
        lat: s.lat ?? null,
        lon: s.lon ?? null,
        status: s.status,
        stationCode: s.stationCode ?? null,
        platform: s.platform ?? null,
        positionIsSnapped: s.positionIsSnapped,
      })),
    );
  }

  saveDelays(delays: readonly Delay[]): Promise<number> {
    return this.insertIgnoringDuplicates(
      t.delays,
      delays.map((d) => ({
        trainNumber: d.runId.trainNumber,
        serviceDate: d.runId.serviceDate,
        source: d.source,
        observedAt: d.observedAt,
        seconds: d.seconds,
        atStationCode: d.atStationCode ?? null,
      })),
    );
  }

  async touchRuns(runs: readonly Run[], seenAt: Date): Promise<void> {
    if (runs.length === 0) return;
    // One row per Run: a repeated Run in the batch would make ON CONFLICT hit it twice.
    const byKey = new Map<string, Run>();
    for (const run of runs) byKey.set(`${run.id.trainNumber}@${run.id.serviceDate}`, run);

    await this.db
      .insert(t.runs)
      .values(
        [...byKey.values()].map((r) => ({
          trainNumber: r.id.trainNumber,
          serviceDate: r.id.serviceDate,
          serviceType: r.serviceType,
          lineCode: r.lineCode ?? null,
          status: r.status ?? null,
          wheelchairAccessible: r.wheelchairAccessible ?? null,
          rollingStock: r.rollingStock ?? null,
          lastSeenAt: seenAt,
        })),
      )
      .onConflictDoUpdate({
        target: [t.runs.trainNumber, t.runs.serviceDate],
        set: {
          serviceType: sql`excluded.service_type`,
          lineCode: sql`coalesce(excluded.line_code, ${t.runs.lineCode})`,
          status: sql`coalesce(excluded.status, ${t.runs.status})`,
          wheelchairAccessible: sql`coalesce(excluded.wheelchair_accessible, ${t.runs.wheelchairAccessible})`,
          rollingStock: sql`coalesce(excluded.rolling_stock, ${t.runs.rollingStock})`,
          lastSeenAt: sql`greatest(excluded.last_seen_at, ${t.runs.lastSeenAt})`,
        },
      });
  }

  async findRun(trainNumber: string, serviceDate: string): Promise<StoredRun | undefined> {
    const [row] = await this.db
      .select()
      .from(t.runs)
      .where(and(eq(t.runs.trainNumber, trainNumber), eq(t.runs.serviceDate, serviceDate)));
    if (!row) return undefined;
    return {
      ...createRun({
        id: createRunId(row.trainNumber, row.serviceDate),
        serviceType: row.serviceType as Run['serviceType'],
        ...(row.lineCode !== null && { lineCode: row.lineCode }),
        ...(row.status !== null && { status: row.status as NonNullable<Run['status']> }),
        ...(row.wheelchairAccessible !== null && {
          wheelchairAccessible: row.wheelchairAccessible,
        }),
        ...(row.rollingStock !== null && { rollingStock: row.rollingStock }),
      }),
      lastSeenAt: row.lastSeenAt,
    };
  }

  async replaceStopEstimates(estimates: readonly RunStopEstimate[]): Promise<void> {
    if (estimates.length === 0) return;
    const runs = new Map(
      estimates.map((e) => [`${e.runId.trainNumber}@${e.runId.serviceDate}`, e.runId]),
    );
    await this.db.transaction(async (tx) => {
      for (const id of runs.values()) {
        await tx
          .delete(t.runStopEstimates)
          .where(
            and(
              eq(t.runStopEstimates.trainNumber, id.trainNumber),
              eq(t.runStopEstimates.serviceDate, id.serviceDate),
            ),
          );
      }
      for (let i = 0; i < estimates.length; i += BATCH_SIZE) {
        await tx.insert(t.runStopEstimates).values(
          estimates.slice(i, i + BATCH_SIZE).map((e) => ({
            trainNumber: e.runId.trainNumber,
            serviceDate: e.runId.serviceDate,
            sequence: e.sequence,
            stationCode: e.stationCode,
            scheduledArrival: e.scheduledArrival,
            scheduledDeparture: e.scheduledDeparture,
            estimatedArrival: e.estimatedArrival,
            estimatedDeparture: e.estimatedDeparture,
          })),
        );
      }
    });
  }

  async listStopEstimates(trainNumber: string, serviceDate: string): Promise<RunStopEstimate[]> {
    const rows = await this.db
      .select()
      .from(t.runStopEstimates)
      .where(
        and(
          eq(t.runStopEstimates.trainNumber, trainNumber),
          eq(t.runStopEstimates.serviceDate, serviceDate),
        ),
      )
      .orderBy(asc(t.runStopEstimates.sequence));
    return rows.map((row) =>
      createRunStopEstimate({
        runId: createRunId(row.trainNumber, row.serviceDate),
        sequence: row.sequence,
        stationCode: row.stationCode,
        scheduledArrival: row.scheduledArrival,
        scheduledDeparture: row.scheduledDeparture,
        estimatedArrival: row.estimatedArrival,
        estimatedDeparture: row.estimatedDeparture,
      }),
    );
  }

  async saveServiceAlerts(alerts: readonly ServiceAlert[]): Promise<void> {
    if (alerts.length === 0) return;
    await this.db
      .insert(t.serviceAlerts)
      .values(
        alerts.map((a) => ({
          id: a.id,
          header: a.header,
          description: a.description,
          url: a.url ?? null,
          activePeriods: a.activePeriods.map((p) => ({
            ...(p.start && { start: p.start.toISOString() }),
            ...(p.end && { end: p.end.toISOString() }),
          })),
          lineCodes: [...a.lineCodes],
          stationCodes: [...a.stationCodes],
          source: a.source,
          endedAt: a.endedAt ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: t.serviceAlerts.id,
        set: {
          header: sql`excluded.header`,
          description: sql`excluded.description`,
          url: sql`excluded.url`,
          activePeriods: sql`excluded.active_periods`,
          lineCodes: sql`excluded.line_codes`,
          stationCodes: sql`excluded.station_codes`,
          source: sql`excluded.source`,
          endedAt: sql`excluded.ended_at`,
        },
      });
  }

  async listServiceAlerts(source?: Source): Promise<ServiceAlert[]> {
    const query = this.db.select().from(t.serviceAlerts).orderBy(t.serviceAlerts.id);
    const rows = await (source ? query.where(eq(t.serviceAlerts.source, source)) : query);
    return rows.map((row) =>
      createServiceAlert({
        id: row.id,
        header: row.header,
        description: row.description,
        ...(row.url !== null && { url: row.url }),
        activePeriods: (row.activePeriods as { start?: string; end?: string }[]).map(
          (p): ActivePeriod => ({
            ...(p.start && { start: new Date(p.start) }),
            ...(p.end && { end: new Date(p.end) }),
          }),
        ),
        lineCodes: row.lineCodes,
        stationCodes: row.stationCodes,
        source: row.source as Source,
        ...(row.endedAt !== null && { endedAt: row.endedAt }),
      }),
    );
  }

  /** Multi-row INSERT .. ON CONFLICT DO NOTHING in chunks; returns how many rows were new. */
  private async insertIgnoringDuplicates<T extends PgTable>(
    table: T,
    rows: T['$inferInsert'][],
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const insertChunks = async (db: PostgresJsDatabase): Promise<number> => {
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const result = await db
          .insert(table)
          .values(rows.slice(i, i + BATCH_SIZE))
          .onConflictDoNothing()
          .returning({ one: sql`1` });
        inserted += result.length;
      }
      return inserted;
    };
    return rows.length <= BATCH_SIZE
      ? insertChunks(this.db)
      : this.db.transaction((tx) => insertChunks(tx as unknown as PostgresJsDatabase));
  }
}
