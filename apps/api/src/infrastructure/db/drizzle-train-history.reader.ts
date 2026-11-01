import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  type RunDelayTotals,
  TrainHistoryReader,
} from '../../application/train-history/train-history.reader.js';
import { DB } from './db.module.js';

interface RunRow extends Record<string, unknown> {
  service_date: string;
  observations: string | number;
  total_seconds: string | number;
  max_seconds: number;
}

@Injectable()
export class DrizzleTrainHistoryReader extends TrainHistoryReader {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async runTotals(trainNumber: string, sinceServiceDate: string): Promise<RunDelayTotals[]> {
    // count and sum come back as strings from Postgres.
    const rows = await this.db.execute<RunRow>(sql`
      SELECT service_date::text AS service_date,
        count(*) AS observations,
        sum(seconds) AS total_seconds,
        max(seconds) AS max_seconds
      FROM delays
      WHERE train_number = ${trainNumber} AND service_date >= ${sinceServiceDate}::date
      GROUP BY service_date`);
    return rows.map((row) => ({
      serviceDate: row.service_date,
      observations: Number(row.observations),
      totalSeconds: Number(row.total_seconds),
      maxSeconds: row.max_seconds,
    }));
  }
}
