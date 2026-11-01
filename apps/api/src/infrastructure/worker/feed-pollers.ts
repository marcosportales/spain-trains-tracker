import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import {
  type FeedHealth,
  FeedHealthSource,
} from '../../application/realtime/feed-health.source.js';
import type { FeedPoller } from './feed-poller.js';

/** Runs every feed poller of the worker and reports their health. */
export class FeedPollers
  extends FeedHealthSource
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(private readonly pollers: readonly Pick<FeedPoller, 'start' | 'stop' | 'health'>[]) {
    super();
  }

  snapshot(): FeedHealth[] {
    return this.pollers.map((poller) => poller.health());
  }

  onApplicationBootstrap(): void {
    for (const poller of this.pollers) poller.start();
  }

  onApplicationShutdown(): void {
    for (const poller of this.pollers) poller.stop();
  }
}
