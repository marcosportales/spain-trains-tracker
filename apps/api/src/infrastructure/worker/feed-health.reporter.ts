import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import type { FeedHealthSource } from '../../application/realtime/feed-health.source.js';
import type { FeedHealthStore } from '../../application/realtime/feed-health.store.js';

/** Periodically copies the pollers' health into the shared store, where the API's `/health` reads it. */
export class FeedHealthReporter implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly source: FeedHealthSource,
    private readonly store: FeedHealthStore,
    private readonly intervalMs: number,
    private readonly logger: { warn(message: string): void },
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.report(), this.intervalMs);
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    await this.report();
  }

  /** Never rejects: a store outage must not stop the worker. */
  async report(): Promise<void> {
    try {
      await this.store.save(this.source.snapshot());
    } catch (error) {
      this.logger.warn(
        `feed health not saved: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
