import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedPoller, type FeedPollerOptions } from './feed-poller.js';

const logger = { log: vi.fn(), warn: vi.fn() };
const bytes = (text: string) => new TextEncoder().encode(text);

function ok(body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status: 200, headers });
}

function poller(
  fetch: FeedPollerOptions['fetch'],
  onUpdate: FeedPollerOptions['onUpdate'] = async () => {},
  extra: Partial<FeedPollerOptions> = {},
) {
  return new FeedPoller({
    feed: 'cercanias-positions',
    url: 'https://example.test/vehicle_positions.pb',
    intervalMs: 20_000,
    fetch,
    onUpdate,
    logger,
    random: () => 1,
    ...extra,
  });
}

describe('FeedPoller', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-11-01T10:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  it('delivers the body of a successful poll and records the success', async () => {
    const fetch = vi.fn(async () => ok('payload'));
    const onUpdate = vi.fn(async () => {});
    const p = poller(fetch, onUpdate);

    await p.pollOnce();

    expect(onUpdate).toHaveBeenCalledWith(bytes('payload'));
    expect(p.health()).toEqual({
      feed: 'cercanias-positions',
      lastSuccessAt: new Date('2026-11-01T10:00:00Z'),
      lastError: null,
      consecutiveFailures: 0,
    });
  });
  it('sends validators from the last update and skips downstream on 304', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        ok('v1', { etag: '"abc"', 'last-modified': 'Sun, 01 Nov 2026 09:59:40 GMT' }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const onUpdate = vi.fn(async () => {});
    const p = poller(fetch, onUpdate);

    await p.pollOnce();
    await p.pollOnce();

    expect(fetch.mock.calls[0]?.[1]?.headers).toEqual({});
    expect(fetch.mock.calls[1]?.[1]?.headers).toEqual({
      'If-None-Match': '"abc"',
      'If-Modified-Since': 'Sun, 01 Nov 2026 09:59:40 GMT',
    });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(p.health().consecutiveFailures).toBe(0);
  });

  it('records HTTP errors, then clears them on the next success', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 503 }))
      .mockResolvedValueOnce(ok('fine'));
    const p = poller(fetch);

    await p.pollOnce();
    expect(p.health()).toMatchObject({
      lastSuccessAt: null,
      lastError: 'GET https://example.test/vehicle_positions.pb failed: 503',
      consecutiveFailures: 1,
    });

    await p.pollOnce();
    expect(p.health()).toMatchObject({ lastError: null, consecutiveFailures: 0 });
  });

  it('does not remember validators when downstream processing fails', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      ok('v1', { etag: '"abc"' }),
    );
    const onUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error('decode failed'))
      .mockResolvedValue(undefined);
    const p = poller(fetch, onUpdate);

    await p.pollOnce();
    await p.pollOnce();

    expect(p.health().lastError).toBeNull();
    expect(fetch.mock.calls[1]?.[1]?.headers).toEqual({});
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('aborts a request that exceeds the timeout and counts it as a failure', async () => {
    const fetch = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const p = poller(fetch, async () => {}, { timeoutMs: 10_000 });

    const polling = p.pollOnce();
    await vi.advanceTimersByTimeAsync(10_000);
    await polling;

    expect(p.health()).toMatchObject({ lastError: 'aborted', consecutiveFailures: 1 });
  });

  describe('schedule', () => {
    it('polls immediately, then every interval', async () => {
      const fetch = vi.fn(async () => ok('x'));
      const p = poller(fetch);
      p.start();

      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(19_999);
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetch).toHaveBeenCalledTimes(2);
      p.stop();
    });

    it('backs off exponentially up to the cap, and resets on success', async () => {
      let failing = true;
      const fetch = vi.fn(async () => (failing ? new Response('', { status: 500 }) : ok('x')));
      const p = poller(fetch, async () => {}, { maxBackoffMs: 300_000 });
      p.start();
      await vi.advanceTimersByTimeAsync(0);

      // random() = 1 means no jitter reduction: 40 s, 80 s, 160 s, then capped at 300 s.
      for (const wait of [40_000, 80_000, 160_000, 300_000, 300_000]) {
        const before = fetch.mock.calls.length;
        await vi.advanceTimersByTimeAsync(wait - 1);
        expect(fetch).toHaveBeenCalledTimes(before);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetch).toHaveBeenCalledTimes(before + 1);
      }

      failing = false;
      await vi.advanceTimersByTimeAsync(300_000);
      const before = fetch.mock.calls.length;
      await vi.advanceTimersByTimeAsync(20_000);
      expect(fetch).toHaveBeenCalledTimes(before + 1);
      p.stop();
    });

    it('applies jitter between half and all of the backoff', async () => {
      const fetch = vi.fn(async () => new Response('', { status: 500 }));
      const p = poller(fetch, async () => {}, { random: () => 0 });
      p.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(19_999); // half of 40 s
      expect(fetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetch).toHaveBeenCalledTimes(2);
      p.stop();
    });

    it('never overlaps polls of the same feed', async () => {
      let release: (() => void) | undefined;
      const fetch = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(ok('x'));
          }),
      );
      const p = poller(fetch, async () => {}, { timeoutMs: 120_000 });
      p.start();

      await vi.advanceTimersByTimeAsync(60_000); // three intervals while the first poll is open
      expect(fetch).toHaveBeenCalledTimes(1);
      release?.();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(fetch).toHaveBeenCalledTimes(2);
      p.stop();
    });

    it('stops scheduling after stop()', async () => {
      const fetch = vi.fn(async () => ok('x'));
      const p = poller(fetch);
      p.start();
      await vi.advanceTimersByTimeAsync(0);
      p.stop();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('does not start a second loop when restarted during a poll', async () => {
      let release: (() => void) | undefined;
      const fetch = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(ok('x'));
          }),
      );
      const p = poller(fetch, async () => {}, { timeoutMs: 120_000 });
      p.start();
      p.stop();
      p.start();
      expect(fetch).toHaveBeenCalledTimes(1);

      release?.();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(fetch).toHaveBeenCalledTimes(2);
      p.stop();
    });

    it('shares the in-flight poll with a direct pollOnce call', async () => {
      const fetch = vi.fn(async () => ok('x'));
      const p = poller(fetch);
      await Promise.all([p.pollOnce(), p.pollOnce()]);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
