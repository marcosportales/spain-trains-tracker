import { IngestVisorFeed } from '../../application/live/ingest-visor-feed.use-case.js';
import type { RunIngestCycle } from '../../application/live/run-ingest-cycle.use-case.js';
import type { MovementRepository } from '../../application/movement/movement.repository.js';
import type { VisorFeed } from '../../application/realtime/visor-feed.js';
import { RENFE_VISOR_URLS } from '../renfe/visor/visor-feed.js';
import { FeedPoller, type PollerLogger } from './feed-poller.js';

export interface VisorPollersOptions {
  /** `VISOR_FEED_ENABLED`. When false no poller exists, so the visor is never contacted. */
  readonly enabled: boolean;
  /** Poll interval of the fleet files; the bigger stops file is polled three times less often. */
  readonly intervalMs: number;
  readonly fetch: typeof fetch;
  readonly logger: PollerLogger;
  readonly feed: VisorFeed;
  readonly cycle: RunIngestCycle;
  readonly repository: MovementRepository;
}

/**
 * The pollers of the optional Visor feed (ADR 0005): none when the flag is off. They are
 * separate pollers from the Official feeds', so a failing or changed visor shows up only in its
 * own health and backoff.
 */
export function createVisorPollers(options: VisorPollersOptions): FeedPoller[] {
  if (!options.enabled) return [];
  const ingest = new IngestVisorFeed(options.feed, options.cycle, options.repository);
  const make = (
    feed: string,
    url: string,
    intervalMs: number,
    onUpdate: (body: Uint8Array) => Promise<void>,
  ) =>
    new FeedPoller({
      feed,
      url,
      intervalMs,
      fetch: options.fetch,
      logger: options.logger,
      onUpdate,
    });

  return [
    make('visor-larga-distancia', RENFE_VISOR_URLS['larga-distancia'], options.intervalMs, (body) =>
      ingest.fleet('larga-distancia', body),
    ),
    make('visor-cercanias', RENFE_VISOR_URLS.cercanias, options.intervalMs, (body) =>
      ingest.fleet('cercanias', body),
    ),
    make('visor-stops', RENFE_VISOR_URLS.stops, options.intervalMs * 3, (body) =>
      ingest.stops(body),
    ),
  ];
}
