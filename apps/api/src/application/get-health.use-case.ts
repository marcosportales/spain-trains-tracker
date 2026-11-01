import { Inject, Injectable } from '@nestjs/common';
import type { HealthDto } from '@stt/contracts';
import { FeedHealthStore } from './realtime/feed-health.store.js';

@Injectable()
export class GetHealth {
  constructor(@Inject(FeedHealthStore) private readonly store: FeedHealthStore) {}

  /** The feeds' last reported health; `down` when the database cannot be reached. */
  async execute(): Promise<HealthDto> {
    try {
      const feeds = await this.store.list();
      return {
        status: 'ok',
        database: 'up',
        feeds: feeds.map((feed) => ({
          ...feed,
          lastSuccessAt: feed.lastSuccessAt?.toISOString() ?? null,
        })),
      };
    } catch {
      return { status: 'down', database: 'down', feeds: [] };
    }
  }
}
