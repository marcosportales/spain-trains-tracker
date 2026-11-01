import type { RunIngestCycle } from '../../application/live/run-ingest-cycle.use-case.js';
import type { PositionFeed } from '../../application/realtime/realtime-positions.source.js';
import {
  GtfsRtAlertsSource,
  type LineCodeLookup,
  RENFE_ALERTS_URL,
} from '../renfe/gtfs-rt/gtfs-rt-alerts.source.js';
import type { ScheduledRunLookup } from '../renfe/gtfs-rt/gtfs-rt-common.js';
import {
  GtfsRtPositionsSource,
  RENFE_POSITION_URLS,
} from '../renfe/gtfs-rt/gtfs-rt-positions.source.js';
import {
  GtfsRtTripUpdatesSource,
  RENFE_TRIP_UPDATE_URLS,
} from '../renfe/gtfs-rt/gtfs-rt-trip-updates.source.js';
import { FeedPoller, type PollerLogger } from './feed-poller.js';

export interface OfficialPollersOptions {
  readonly intervalMs: number;
  readonly fetch: typeof fetch;
  readonly logger: PollerLogger;
  readonly cycle: RunIngestCycle;
  readonly timetable: ScheduledRunLookup;
  readonly lines: LineCodeLookup;
}

const FEEDS: readonly PositionFeed[] = ['cercanias', 'larga-distancia'];

/**
 * The pollers of the Official GTFS-RT feeds (ADR 0005), always on: vehicle positions and trip
 * updates of Cercanías and larga distancia, and the Cercanías alerts. Each file has its own
 * poller, so one failing feed shows up only in its own health and backoff.
 */
export function createOfficialPollers(options: OfficialPollersOptions): FeedPoller[] {
  const { cycle, timetable, lines } = options;
  const onSkipped = (feed: string) => (p: { entityId: string; reason: string }) =>
    options.logger.warn(`${feed} entity ${p.entityId} skipped: ${p.reason}`);

  return [
    ...FEEDS.map((feed) =>
      make(options, `gtfsrt-positions-${feed}`, RENFE_POSITION_URLS[feed], async (fetch) => {
        const source = new GtfsRtPositionsSource({
          timetable,
          fetch,
          onSkipped: onSkipped(`gtfsrt-positions-${feed}`),
        });
        const sightings = await source.fetchSightings(feed);
        await cycle.execute({ sightings, delays: [], runs: [] });
      }),
    ),
    ...FEEDS.map((feed) =>
      make(options, `gtfsrt-trip-updates-${feed}`, RENFE_TRIP_UPDATE_URLS[feed], async (fetch) => {
        const source = new GtfsRtTripUpdatesSource({
          timetable,
          fetch,
          onSkipped: onSkipped(`gtfsrt-trip-updates-${feed}`),
        });
        const { delays, runs } = await source.fetchTripUpdates(feed);
        await cycle.execute({ sightings: [], delays, runs });
      }),
    ),
    make(options, 'gtfsrt-alerts', RENFE_ALERTS_URL, async (fetch) => {
      const source = new GtfsRtAlertsSource({
        lines,
        fetch,
        onSkipped: onSkipped('gtfsrt-alerts'),
      });
      const alerts = await source.fetchServiceAlerts();
      await cycle.execute({
        sightings: [],
        delays: [],
        runs: [],
        alerts: { source: 'gtfsrt_cercanias', alerts },
      });
    }),
  ];
}

/**
 * A poller that does the conditional GET itself and hands the adapter the body it already got:
 * the adapter's own `fetch` is answered from that body (and the response's headers, which the
 * adapters read for timestamps), so each poll costs one request.
 */
function make(
  options: OfficialPollersOptions,
  feed: string,
  url: string,
  process: (replay: typeof fetch) => Promise<void>,
): FeedPoller {
  let headers = new Headers();
  const recording = (async (input, init) => {
    const response = await options.fetch(input, init);
    headers = response.headers;
    return response;
  }) as typeof fetch;
  return new FeedPoller({
    feed,
    url,
    intervalMs: options.intervalMs,
    fetch: recording,
    logger: options.logger,
    onUpdate: (body) =>
      process((async () => new Response(body, { status: 200, headers })) as typeof fetch),
  });
}
