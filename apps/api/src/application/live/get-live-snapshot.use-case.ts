import type { Source as ContractSource, LiveSnapshot } from '@stt/contracts';
import { chooseLivePosition, type Source } from '../../domain/movement/index.js';
import type { ServiceType } from '../../domain/network/index.js';
import type { NetworkRepository } from '../network/network.repository.js';
import type { LiveRunsFilter, LiveRunsReader } from './live-runs.reader.js';
import type { LiveRunStatus } from './live-updates.publisher.js';

/** A Run counts as live when one of its Sightings is at most this old. */
export const LIVE_WINDOW_MS = 3 * 60 * 1000;

export interface LiveSnapshotQuery {
  readonly serviceType?: ServiceType;
  readonly hubCode?: string;
  readonly lineCode?: string;
}

/** A filter names a Hub or Line that does not exist. */
export class UnknownLiveFilterError extends Error {
  constructor(
    readonly filter: 'hub' | 'line',
    readonly value: string,
  ) {
    super(`Unknown ${filter} "${value}"`);
    this.name = 'UnknownLiveFilterError';
  }
}

const STATUS_OF = {
  STOPPED_AT: 'stopped_at',
  INCOMING_AT: 'incoming_at',
  IN_TRANSIT_TO: 'in_transit_to',
} as const satisfies Record<string, LiveRunStatus>;

const toContractSource = (source: Source): ContractSource =>
  source.startsWith('visor') ? 'visor' : 'official';

/** All Runs seen in the last 3 minutes, one position each, with their latest Delay. */
export class GetLiveSnapshot {
  constructor(
    private readonly reader: LiveRunsReader,
    private readonly network: NetworkRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(query: LiveSnapshotQuery): Promise<LiveSnapshot> {
    await this.assertKnown(query);
    const generatedAt = this.now();
    const since = new Date(generatedAt.getTime() - LIVE_WINDOW_MS);
    const filter: LiveRunsFilter = {
      ...(query.serviceType !== undefined && { serviceType: query.serviceType }),
      ...(query.hubCode !== undefined && { hubCode: query.hubCode }),
      ...(query.lineCode !== undefined && { lineCode: query.lineCode }),
    };

    const runs: LiveSnapshot['runs'] = [];
    for (const recent of await this.reader.listRecentRuns(since, filter)) {
      const position = chooseLivePosition(recent.sightings);
      const sighting = position?.sighting;
      if (!position || sighting?.lat === undefined || sighting.lon === undefined) continue;
      runs.push({
        trainNumber: recent.runId.trainNumber,
        serviceDate: recent.runId.serviceDate,
        serviceType: recent.serviceType,
        ...(recent.lineCode !== undefined && { lineCode: recent.lineCode }),
        lat: sighting.lat,
        lon: sighting.lon,
        status: STATUS_OF[sighting.status],
        ...(recent.delay !== undefined && { delaySeconds: recent.delay.seconds }),
        ...(sighting.stationCode !== undefined && { nextStationCode: sighting.stationCode }),
        sources: [...new Set(position.sources.map(toContractSource))],
        observedAt: sighting.observedAt.toISOString(),
      });
    }
    runs.sort(
      (a, b) =>
        a.serviceDate.localeCompare(b.serviceDate) || a.trainNumber.localeCompare(b.trainNumber),
    );
    // Cycle ids are millisecond timestamps (see RunIngestCycle), so "now" orders against them.
    return { cycleId: generatedAt.getTime(), generatedAt: generatedAt.toISOString(), runs };
  }

  private async assertKnown(query: LiveSnapshotQuery): Promise<void> {
    if (query.hubCode !== undefined) {
      const hubs = await this.network.listHubs();
      if (!hubs.some((hub) => hub.code === query.hubCode)) {
        throw new UnknownLiveFilterError('hub', query.hubCode);
      }
    }
    if (query.lineCode !== undefined) {
      const lines = await this.network.listLines();
      if (!lines.some((line) => line.code === query.lineCode)) {
        throw new UnknownLiveFilterError('line', query.lineCode);
      }
    }
  }
}
