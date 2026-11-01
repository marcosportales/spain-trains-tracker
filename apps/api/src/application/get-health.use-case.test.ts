import { describe, expect, it } from 'vitest';
import { GetHealth } from './get-health.use-case.js';
import type { FeedHealth } from './realtime/feed-health.source.js';
import { FeedHealthStore } from './realtime/feed-health.store.js';

class FakeStore extends FeedHealthStore {
  constructor(private readonly feeds: FeedHealth[] | Error) {
    super();
  }
  async save(): Promise<void> {}
  async list(): Promise<FeedHealth[]> {
    if (this.feeds instanceof Error) throw this.feeds;
    return this.feeds;
  }
}

describe('GetHealth', () => {
  it('reports each feed with its lastSuccessAt', async () => {
    const health = new GetHealth(
      new FakeStore([
        {
          feed: 'visor-cercanias',
          lastSuccessAt: new Date('2026-10-31T10:15:30Z'),
          lastError: null,
          consecutiveFailures: 0,
        },
        { feed: 'visor-stops', lastSuccessAt: null, lastError: 'boom', consecutiveFailures: 3 },
      ]),
    );
    expect(await health.execute()).toEqual({
      status: 'ok',
      database: 'up',
      feeds: [
        {
          feed: 'visor-cercanias',
          lastSuccessAt: '2026-10-31T10:15:30.000Z',
          lastError: null,
          consecutiveFailures: 0,
        },
        { feed: 'visor-stops', lastSuccessAt: null, lastError: 'boom', consecutiveFailures: 3 },
      ],
    });
  });

  it('reports ok with no feeds when none are polled', async () => {
    expect(await new GetHealth(new FakeStore([])).execute()).toEqual({
      status: 'ok',
      database: 'up',
      feeds: [],
    });
  });

  it('reports the database down when the store cannot be read', async () => {
    const report = await new GetHealth(new FakeStore(new Error('connection refused'))).execute();
    expect(report).toEqual({ status: 'down', database: 'down', feeds: [] });
  });
});
