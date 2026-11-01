import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, isNotNull, type SQL } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  type LiveRunsFilter,
  LiveRunsReader,
  type RecentRun,
} from '../../application/live/live-runs.reader.js';
import {
  createDelay,
  createRunId,
  createSighting,
  type Delay,
  runIdKey,
  type Sighting,
  type Source,
} from '../../domain/movement/index.js';
import type { ServiceType } from '../../domain/network/index.js';
import { DB } from './db.module.js';
import * as t from './schema/index.js';

@Injectable()
export class DrizzleLiveRunsReader extends LiveRunsReader {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async listRecentRuns(since: Date, filter: LiveRunsFilter): Promise<RecentRun[]> {
    const conditions: SQL[] = [
      gte(t.sightings.observedAt, since),
      isNotNull(t.sightings.lat),
      isNotNull(t.sightings.lon),
    ];
    if (filter.serviceType) conditions.push(eq(t.runs.serviceType, filter.serviceType));
    if (filter.lineCode) conditions.push(eq(t.runs.lineCode, filter.lineCode));
    if (filter.hubCode) conditions.push(eq(t.lines.hubCode, filter.hubCode));

    // The newest Sighting of each Run per Source.
    const rows = await this.db
      .selectDistinctOn([t.sightings.trainNumber, t.sightings.serviceDate, t.sightings.source], {
        sighting: t.sightings,
        serviceType: t.runs.serviceType,
        lineCode: t.runs.lineCode,
      })
      .from(t.sightings)
      .innerJoin(
        t.runs,
        and(
          eq(t.runs.trainNumber, t.sightings.trainNumber),
          eq(t.runs.serviceDate, t.sightings.serviceDate),
        ),
      )
      .leftJoin(t.lines, eq(t.lines.code, t.runs.lineCode))
      .where(and(...conditions))
      .orderBy(
        t.sightings.trainNumber,
        t.sightings.serviceDate,
        t.sightings.source,
        desc(t.sightings.observedAt),
      );

    const delays = await this.latestDelays(since);
    const byRun = new Map<string, RecentRun & { sightings: Sighting[] }>();
    for (const row of rows) {
      const runId = createRunId(row.sighting.trainNumber, row.sighting.serviceDate);
      const key = runIdKey(runId);
      let recent = byRun.get(key);
      if (!recent) {
        const delay = delays.get(key);
        recent = {
          runId,
          serviceType: row.serviceType as ServiceType,
          ...(row.lineCode !== null && { lineCode: row.lineCode }),
          sightings: [],
          ...(delay && { delay }),
        };
        byRun.set(key, recent);
      }
      recent.sightings.push(
        createSighting({
          runId,
          source: row.sighting.source as Source,
          observedAt: row.sighting.observedAt,
          ...(row.sighting.lat !== null && { lat: row.sighting.lat }),
          ...(row.sighting.lon !== null && { lon: row.sighting.lon }),
          status: row.sighting.status as Sighting['status'],
          ...(row.sighting.stationCode !== null && { stationCode: row.sighting.stationCode }),
          ...(row.sighting.platform !== null && { platform: row.sighting.platform }),
          positionIsSnapped: row.sighting.positionIsSnapped,
        }),
      );
    }
    return [...byRun.values()];
  }

  /** The newest Delay of each Run since `since`. */
  private async latestDelays(since: Date): Promise<Map<string, Delay>> {
    const rows = await this.db
      .selectDistinctOn([t.delays.trainNumber, t.delays.serviceDate])
      .from(t.delays)
      .where(gte(t.delays.observedAt, since))
      .orderBy(t.delays.trainNumber, t.delays.serviceDate, desc(t.delays.observedAt));
    const delays = new Map<string, Delay>();
    for (const row of rows) {
      const runId = createRunId(row.trainNumber, row.serviceDate);
      delays.set(
        runIdKey(runId),
        createDelay({
          runId,
          source: row.source as Source,
          observedAt: row.observedAt,
          seconds: row.seconds,
          ...(row.atStationCode !== null && { atStationCode: row.atStationCode }),
        }),
      );
    }
    return delays;
  }
}
