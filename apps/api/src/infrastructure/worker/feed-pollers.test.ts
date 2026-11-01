import { describe, expect, it, vi } from 'vitest';
import { FeedPollers } from './feed-pollers.js';

function fakePoller(feed: string) {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    health: () => ({ feed, lastSuccessAt: null, lastError: null, consecutiveFailures: 0 }),
  };
}

describe('FeedPollers', () => {
  it('exposes one health entry per poller through the FeedHealthSource port', () => {
    const pollers = new FeedPollers([fakePoller('a'), fakePoller('b')]);
    expect(pollers.snapshot().map((health) => health.feed)).toEqual(['a', 'b']);
  });

  it('starts on bootstrap and stops on shutdown', () => {
    const a = fakePoller('a');
    const pollers = new FeedPollers([a]);
    pollers.onApplicationBootstrap();
    pollers.onApplicationShutdown();
    expect(a.start).toHaveBeenCalledTimes(1);
    expect(a.stop).toHaveBeenCalledTimes(1);
  });
});
