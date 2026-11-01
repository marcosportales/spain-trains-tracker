import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StaticImportScheduler } from './static-import.scheduler.js';

const logger = { log: vi.fn(), error: vi.fn() };

function importer(missing: boolean) {
  return {
    isMissingData: vi.fn(async () => missing),
    execute: vi.fn(async () => []),
  };
}

describe('StaticImportScheduler', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-12-01T01:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  it('imports on startup when a source was never imported', async () => {
    const imp = importer(true);
    const scheduler = new StaticImportScheduler(imp, logger);
    await scheduler.runIfNeverImported();
    expect(imp.execute).toHaveBeenCalledTimes(1);
  });

  it('does not import on startup when everything was imported before', async () => {
    const imp = importer(false);
    await new StaticImportScheduler(imp, logger).runIfNeverImported();
    expect(imp.execute).not.toHaveBeenCalled();
  });

  it('imports at 03:30 Madrid time and schedules the next day', async () => {
    const imp = importer(false);
    const scheduler = new StaticImportScheduler(imp, logger);
    scheduler.onApplicationBootstrap();

    await vi.advanceTimersByTimeAsync(89 * 60_000); // 02:29Z, one minute early
    expect(imp.execute).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(imp.execute).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(24 * 3_600_000);
    expect(imp.execute).toHaveBeenCalledTimes(2);
    scheduler.onApplicationShutdown();
  });

  it('keeps running after a failed import', async () => {
    const imp = importer(false);
    imp.execute.mockRejectedValueOnce(new Error('boom'));
    const scheduler = new StaticImportScheduler(imp, logger);
    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(2 * 3_600_000);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
    await vi.advanceTimersByTimeAsync(24 * 3_600_000);
    expect(imp.execute).toHaveBeenCalledTimes(2);
    scheduler.onApplicationShutdown();
  });
});
