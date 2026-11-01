import { Inject, Injectable } from '@nestjs/common';
import type postgres from 'postgres';
import { LiveNotifications } from '../../application/live/live-notifications.js';
import { SQL_CLIENT } from './db.module.js';
import { LIVE_RUNS_CHANNEL } from './postgres-live-updates.publisher.js';

/** Listens on `live_runs`, the channel the worker notifies after each ingest cycle. */
@Injectable()
export class PostgresLiveNotifications extends LiveNotifications {
  constructor(
    @Inject(SQL_CLIENT) private readonly sql: postgres.Sql,
    private readonly channel: string = LIVE_RUNS_CHANNEL,
  ) {
    super();
  }

  async listen(onCycle: (cycleId: number) => void): Promise<() => Promise<void>> {
    const subscription = await this.sql.listen(this.channel, (payload) => {
      const cycleId = Number(payload);
      if (Number.isSafeInteger(cycleId) && cycleId >= 0) onCycle(cycleId);
    });
    return () => subscription.unlisten();
  }
}
