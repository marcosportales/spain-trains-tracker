import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { DrizzleFeedHealthStore } from './drizzle-feed-health.store.js';

describe('DrizzleFeedHealthStore', () => {
  let testDb: TestDatabase;
  let store: DrizzleFeedHealthStore;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    store = new DrizzleFeedHealthStore(testDb.db);
  });
  afterAll(() => testDb.close());

  it('lists nothing before the worker reports', async () => {
    expect(await store.list()).toEqual([]);
  });

  it('saves feeds and overwrites them on the next report', async () => {
    const ok = new Date('2026-10-31T10:15:30Z');
    await store.save([
      { feed: 'b', lastSuccessAt: null, lastError: 'boom', consecutiveFailures: 2 },
      { feed: 'a', lastSuccessAt: ok, lastError: null, consecutiveFailures: 0 },
    ]);
    expect(await store.list()).toEqual([
      { feed: 'a', lastSuccessAt: ok, lastError: null, consecutiveFailures: 0 },
      { feed: 'b', lastSuccessAt: null, lastError: 'boom', consecutiveFailures: 2 },
    ]);

    await store.save([{ feed: 'b', lastSuccessAt: ok, lastError: null, consecutiveFailures: 0 }]);
    expect((await store.list()).find((f) => f.feed === 'b')).toEqual({
      feed: 'b',
      lastSuccessAt: ok,
      lastError: null,
      consecutiveFailures: 0,
    });
  });
});
