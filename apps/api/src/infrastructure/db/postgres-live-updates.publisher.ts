import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  type LiveUpdate,
  LiveUpdatesPublisher,
} from '../../application/live/live-updates.publisher.js';
import { DB } from './db.module.js';

export const LIVE_RUNS_CHANNEL = 'live_runs';

/** Publishes with `NOTIFY live_runs, '<cycleId>'`; the payload stays small, the API reads the DB. */
@Injectable()
export class PostgresLiveUpdatesPublisher extends LiveUpdatesPublisher {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async publish(update: LiveUpdate): Promise<void> {
    await this.db.execute(sql`SELECT pg_notify(${LIVE_RUNS_CHANNEL}, ${String(update.cycleId)})`);
  }
}
