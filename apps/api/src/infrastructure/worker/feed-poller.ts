import type { FeedHealth } from '../../application/realtime/feed-health.source.js';

export type PollerLogger = {
  log(message: string): void;
  warn(message: string): void;
};

export interface FeedPollerOptions {
  readonly feed: string;
  readonly url: string;
  readonly intervalMs: number;
  readonly fetch: typeof fetch;
  /** Downstream processing of a changed feed body. Not called on `304 Not Modified`. */
  readonly onUpdate: (body: Uint8Array) => Promise<void>;
  readonly logger: PollerLogger;
  readonly timeoutMs?: number;
  readonly maxBackoffMs?: number;
  readonly random?: () => number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BACKOFF_MS = 300_000;

/**
 * Wait before the next poll: the plain interval while healthy; after failures, the interval doubled
 * per consecutive failure, capped, then jittered into [cap/2, cap] (`random` is in [0, 1]).
 */
export function backoffDelayMs(input: {
  intervalMs: number;
  maxBackoffMs: number;
  consecutiveFailures: number;
  random: number;
}): number {
  if (input.consecutiveFailures === 0) return input.intervalMs;
  const exponential = Math.min(
    input.maxBackoffMs,
    input.intervalMs * 2 ** input.consecutiveFailures,
  );
  return Math.round(exponential / 2 + (input.random * exponential) / 2);
}

/** Polls one Official feed with conditional GET, a fixed schedule and backoff on errors. */
export class FeedPoller {
  private lastSuccessAt: Date | null = null;
  private lastError: string | null = null;
  private consecutiveFailures = 0;

  private running = false;
  private inFlight: Promise<void> | undefined;
  private timer: NodeJS.Timeout | undefined;
  private etag: string | undefined;
  private lastModified: string | undefined;

  constructor(private readonly options: FeedPollerOptions) {}

  /** Polls now, then keeps polling until `stop()`. The next poll is scheduled only after the current one ends. */
  start(): void {
    if (this.running) return;
    this.running = true;
    // A cycle still finishing from before a stop() carries on scheduling by itself.
    if (this.inFlight === undefined) void this.cycle();
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async cycle(): Promise<void> {
    await this.pollOnce();
    if (!this.running) return;
    const delayMs = this.nextDelayMs();
    if (this.consecutiveFailures > 0) {
      this.options.logger.warn(`feed ${this.options.feed} retrying in ${delayMs} ms`);
    }
    this.timer = setTimeout(() => void this.cycle(), delayMs);
  }

  private nextDelayMs(): number {
    const {
      intervalMs,
      maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
      random = Math.random,
    } = this.options;
    return backoffDelayMs({
      intervalMs,
      maxBackoffMs,
      consecutiveFailures: this.consecutiveFailures,
      random: random(),
    });
  }

  /** One poll, shared with any poll already running. Never rejects: failures go to health and logs. */
  pollOnce(): Promise<void> {
    this.inFlight ??= this.runPoll().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async runPoll(): Promise<void> {
    try {
      await this.fetchAndProcess();
      if (this.consecutiveFailures > 0) {
        this.options.logger.log(`feed ${this.options.feed} recovered`);
      }
      this.lastSuccessAt = new Date();
      this.lastError = null;
      this.consecutiveFailures = 0;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.consecutiveFailures += 1;
      this.options.logger.warn(
        `feed ${this.options.feed} poll failed (${this.consecutiveFailures} in a row): ${this.lastError}`,
      );
    }
  }

  private async fetchAndProcess(): Promise<void> {
    const { url, feed } = this.options;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      const response = await this.options.fetch(url, {
        headers: this.validators(),
        signal: controller.signal,
      });
      if (response.status === 304) return;
      if (!response.ok) throw new Error(`GET ${url} failed: ${response.status}`);
      const body = new Uint8Array(await response.arrayBuffer());
      await this.options.onUpdate(body);
      // Remembered only after processing succeeds, so a failed update is fetched again in full.
      this.etag = response.headers.get('etag') ?? undefined;
      this.lastModified = response.headers.get('last-modified') ?? undefined;
      this.options.logger.log(`feed ${feed} updated (${body.byteLength} bytes)`);
    } finally {
      clearTimeout(timer);
    }
  }

  private validators(): Record<string, string> {
    return {
      ...(this.etag !== undefined && { 'If-None-Match': this.etag }),
      ...(this.lastModified !== undefined && { 'If-Modified-Since': this.lastModified }),
    };
  }

  health(): FeedHealth {
    return {
      feed: this.options.feed,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}
