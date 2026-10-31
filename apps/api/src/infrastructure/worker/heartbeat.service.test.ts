import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeartbeatService } from './heartbeat.service.js';

describe('HeartbeatService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('logs a heartbeat on every interval until shutdown', () => {
    const log = vi.fn();
    const service = new HeartbeatService({ log }, 20_000);

    service.onApplicationBootstrap();
    vi.advanceTimersByTime(60_000);
    expect(log).toHaveBeenCalledTimes(3);

    service.onApplicationShutdown();
    vi.advanceTimersByTime(60_000);
    expect(log).toHaveBeenCalledTimes(3);
  });
});
