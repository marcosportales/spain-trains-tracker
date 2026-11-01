import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedHealth } from '../../application/realtime/feed-health.source.js';
import { FeedHealthSource } from '../../application/realtime/feed-health.source.js';
import { FeedHealthStore } from '../../application/realtime/feed-health.store.js';
import { FeedHealthReporter } from './feed-health.reporter.js';

const feed: FeedHealth = {
  feed: 'a',
  lastSuccessAt: null,
  lastError: null,
  consecutiveFailures: 0,
};

class FakeSource extends FeedHealthSource {
  snapshot(): FeedHealth[] {
    return [feed];
  }
}

class FakeStore extends FeedHealthStore {
  saved: (readonly FeedHealth[])[] = [];
  failing = false;
  async save(feeds: readonly FeedHealth[]): Promise<void> {
    if (this.failing) throw new Error('db down');
    this.saved.push(feeds);
  }
  async list(): Promise<FeedHealth[]> {
    return [];
  }
}

describe('FeedHealthReporter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves the snapshot every interval and once more on shutdown', async () => {
    const store = new FakeStore();
    const reporter = new FeedHealthReporter(new FakeSource(), store, 1000, { warn: vi.fn() });
    reporter.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.saved).toHaveLength(2);
    await reporter.onApplicationShutdown();
    expect(store.saved).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.saved).toHaveLength(3);
  });

  it('logs and carries on when the store is down', async () => {
    const store = new FakeStore();
    store.failing = true;
    const warn = vi.fn();
    const reporter = new FeedHealthReporter(new FakeSource(), store, 1000, { warn });
    await expect(reporter.report()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });
});
