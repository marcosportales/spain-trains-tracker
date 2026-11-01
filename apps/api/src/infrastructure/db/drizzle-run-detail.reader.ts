import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { RunDetailReader, type StoredRunDetail } from '../../application/run/run-detail.reader.js';
import {
  createDelay,
  createRun,
  createRunId,
  createRunStopEstimate,
  createSighting,
  type Run,
  type Sighting,
  type Source,
} from '../../domain/movement/index.js';
import { DB } from './db.module.js';
import * as t from './schema/index.js';

@Injectable()
export class DrizzleRunDetailReader extends RunDetailReader {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async findRunDetail(
    trainNumber: string,
    serviceDate: string,
  ): Promise<StoredRunDetail | undefined> {
    const [row] = await this.db
      .select()
      .from(t.runs)
      .where(and(eq(t.runs.trainNumber, trainNumber), eq(t.runs.serviceDate, serviceDate)));
    if (!row) return undefined;
    const runId = createRunId(row.trainNumber, row.serviceDate);

    const sightingRows = await this.db
      .selectDistinctOn([t.sightings.source])
      .from(t.sightings)
      .where(
        and(
          eq(t.sightings.trainNumber, trainNumber),
          eq(t.sightings.serviceDate, serviceDate),
          isNotNull(t.sightings.lat),
          isNotNull(t.sightings.lon),
        ),
      )
      .orderBy(t.sightings.source, desc(t.sightings.observedAt));

    const [delayRow] = await this.db
      .select()
      .from(t.delays)
      .where(and(eq(t.delays.trainNumber, trainNumber), eq(t.delays.serviceDate, serviceDate)))
      .orderBy(desc(t.delays.observedAt))
      .limit(1);

    const estimateRows = await this.db
      .select()
      .from(t.runStopEstimates)
      .where(
        and(
          eq(t.runStopEstimates.trainNumber, trainNumber),
          eq(t.runStopEstimates.serviceDate, serviceDate),
        ),
      )
      .orderBy(asc(t.runStopEstimates.sequence));

    return {
      run: {
        ...createRun({
          id: runId,
          serviceType: row.serviceType as Run['serviceType'],
          ...(row.lineCode !== null && { lineCode: row.lineCode }),
          ...(row.status !== null && { status: row.status as NonNullable<Run['status']> }),
          ...(row.wheelchairAccessible !== null && {
            wheelchairAccessible: row.wheelchairAccessible,
          }),
          ...(row.rollingStock !== null && { rollingStock: row.rollingStock }),
        }),
        lastSeenAt: row.lastSeenAt,
      },
      sightings: sightingRows.map((s) =>
        createSighting({
          runId,
          source: s.source as Source,
          observedAt: s.observedAt,
          ...(s.lat !== null && { lat: s.lat }),
          ...(s.lon !== null && { lon: s.lon }),
          status: s.status as Sighting['status'],
          ...(s.stationCode !== null && { stationCode: s.stationCode }),
          ...(s.platform !== null && { platform: s.platform }),
          positionIsSnapped: s.positionIsSnapped,
        }),
      ),
      ...(delayRow && {
        delay: createDelay({
          runId,
          source: delayRow.source as Source,
          observedAt: delayRow.observedAt,
          seconds: delayRow.seconds,
          ...(delayRow.atStationCode !== null && { atStationCode: delayRow.atStationCode }),
        }),
      }),
      stopEstimates: estimateRows.map((e) =>
        createRunStopEstimate({
          runId,
          sequence: e.sequence,
          stationCode: e.stationCode,
          scheduledArrival: e.scheduledArrival,
          scheduledDeparture: e.scheduledDeparture,
          estimatedArrival: e.estimatedArrival,
          estimatedDeparture: e.estimatedDeparture,
        }),
      ),
    };
  }
}
