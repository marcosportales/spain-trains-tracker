import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { FeedHealth } from '../../application/realtime/feed-health.source.js';
import { FeedHealthStore } from '../../application/realtime/feed-health.store.js';
import { DB } from './db.module.js';
import { feedHealth } from './schema/index.js';

@Injectable()
export class DrizzleFeedHealthStore extends FeedHealthStore {
  constructor(@Inject(DB) private readonly db: PostgresJsDatabase) {
    super();
  }

  async save(feeds: readonly FeedHealth[]): Promise<void> {
    if (feeds.length === 0) return;
    const updatedAt = new Date();
    await this.db
      .insert(feedHealth)
      .values(feeds.map((feed) => ({ ...feed, updatedAt })))
      .onConflictDoUpdate({
        target: feedHealth.feed,
        set: {
          lastSuccessAt: sql`excluded.last_success_at`,
          lastError: sql`excluded.last_error`,
          consecutiveFailures: sql`excluded.consecutive_failures`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async list(): Promise<FeedHealth[]> {
    const rows = await this.db.select().from(feedHealth).orderBy(feedHealth.feed);
    return rows.map(({ feed, lastSuccessAt, lastError, consecutiveFailures }) => ({
      feed,
      lastSuccessAt,
      lastError,
      consecutiveFailures,
    }));
  }
}
