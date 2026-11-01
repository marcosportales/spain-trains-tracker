import {
  chooseLivePosition,
  createRun,
  type Delay,
  type LivePosition,
  type Run,
  reconcileServiceAlerts,
  runIdKey,
  type ServiceAlert,
  type Sighting,
  type SightingStatus,
  type Source,
} from '../../domain/movement/index.js';
import type { ServiceType } from '../../domain/network/index.js';
import type { MovementRepository } from '../movement/movement.repository.js';
import type { LiveRun, LiveRunStatus, LiveUpdatesPublisher } from './live-updates.publisher.js';

/** What one poll produced, already mapped to domain objects. Any part may be empty. */
export interface PollResult {
  readonly sightings: readonly Sighting[];
  readonly delays: readonly Delay[];
  /** Run facts (type, Line, status) from the same poll; they win over what is stored. */
  readonly runs: readonly Run[];
  /** The full current alert list of a Source. Omit when the poll did not read alerts. */
  readonly alerts?: { readonly source: Source; readonly alerts: readonly ServiceAlert[] };
}

export interface IngestReport {
  readonly cycleId: number;
  readonly changedRuns: number;
}

export interface RunIngestCycleOptions {
  readonly now?: () => Date;
  /** A Source's Sighting this much older than the Run's newest one no longer counts. */
  readonly sightingMaxAgeMs?: number;
}

const DEFAULT_SIGHTING_MAX_AGE_MS = 5 * 60 * 1000;

const STATUS_OF: Readonly<Record<SightingStatus, LiveRunStatus>> = {
  STOPPED_AT: 'stopped_at',
  INCOMING_AT: 'incoming_at',
  IN_TRANSIT_TO: 'in_transit_to',
};

/**
 * Ingests one poll result: resolves Runs, stores Runs, Sightings, Delays and Service alerts, works
 * out which live Runs changed and publishes them. Everything is stored before anything is
 * published, and a poll that fails midway can be run again: storage ignores duplicates.
 */
export class RunIngestCycle {
  private readonly now: () => Date;
  private readonly sightingMaxAgeMs: number;
  private lastCycleId = 0;
  /** Last published state of each Run, to publish only what changed and to carry Delays over. */
  private readonly live = new Map<string, LiveRun>();
  /** Run facts learned so far, so stored Runs are looked up only once. */
  private readonly runs = new Map<string, Run>();
  /** Latest Sighting of each Run per Source: a Run in several feeds merges into one live Run. */
  private readonly sightings = new Map<string, Map<Source, Sighting>>();

  constructor(
    private readonly repository: MovementRepository,
    private readonly publisher: LiveUpdatesPublisher,
    options: RunIngestCycleOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.sightingMaxAgeMs = options.sightingMaxAgeMs ?? DEFAULT_SIGHTING_MAX_AGE_MS;
  }

  async execute(poll: PollResult): Promise<IngestReport> {
    const seenAt = this.now();
    const known = await this.resolveRuns(poll);

    await this.repository.touchRuns([...known.values()], seenAt);
    await this.repository.saveSightings(poll.sightings);
    await this.repository.saveDelays(poll.delays);
    if (poll.alerts) await this.saveAlerts(poll.alerts.source, poll.alerts.alerts, seenAt);

    const changed = this.changedRuns(poll, known);
    this.lastCycleId = Math.max(this.lastCycleId + 1, seenAt.getTime());
    const cycleId = this.lastCycleId;
    if (changed.length > 0) {
      await this.publisher.publish({ cycleId, upserted: changed });
      for (const run of changed) this.live.set(runIdKey(run.runId), run);
    }
    for (const run of known.values()) this.runs.set(runIdKey(run.id), run);
    return { cycleId, changedRuns: changed.length };
  }

  /** Run facts for every Run named in the poll: the poll's own, else known, else stored. */
  private async resolveRuns(poll: PollResult): Promise<Map<string, Run>> {
    const resolved = new Map<string, Run>();
    for (const run of poll.runs) {
      const previous = this.runs.get(runIdKey(run.id));
      resolved.set(runIdKey(run.id), previous ? mergeRun(previous, run) : run);
    }
    const ids = [...poll.sightings.map((s) => s.runId), ...poll.delays.map((d) => d.runId)];
    for (const id of ids) {
      const key = runIdKey(id);
      if (resolved.has(key)) continue;
      const known =
        this.runs.get(key) ?? (await this.repository.findRun(id.trainNumber, id.serviceDate));
      if (known) {
        const { id: runId, serviceType, lineCode, status, wheelchairAccessible } = known;
        resolved.set(
          key,
          createRun({
            id: runId,
            serviceType,
            ...(lineCode !== undefined && { lineCode }),
            ...(status !== undefined && { status }),
            ...(wheelchairAccessible !== undefined && { wheelchairAccessible }),
          }),
        );
      }
    }
    return resolved;
  }

  private async saveAlerts(
    source: Source,
    latest: readonly ServiceAlert[],
    now: Date,
  ): Promise<void> {
    const stored = await this.repository.listServiceAlerts(source);
    const merged = reconcileServiceAlerts(stored, latest, source, now);
    await this.repository.saveServiceAlerts(merged.filter((alert) => alert.source === source));
  }

  private changedRuns(poll: PollResult, known: Map<string, Run>): LiveRun[] {
    const touched = new Set<string>();
    for (const s of poll.sightings) {
      const key = runIdKey(s.runId);
      const perSource = this.sightings.get(key) ?? new Map<Source, Sighting>();
      const current = perSource.get(s.source);
      if (!current || s.observedAt >= current.observedAt) perSource.set(s.source, s);
      this.sightings.set(key, perSource);
      touched.add(key);
    }
    const latestDelay = new Map<string, Delay>();
    for (const d of poll.delays) {
      const key = runIdKey(d.runId);
      const current = latestDelay.get(key);
      if (!current || d.observedAt >= current.observedAt) latestDelay.set(key, d);
    }

    const changed: LiveRun[] = [];
    for (const key of new Set([...touched, ...latestDelay.keys()])) {
      const run = known.get(key);
      const previous = this.live.get(key);
      const delay = latestDelay.get(key);
      const position = chooseLivePosition(this.currentSightings(key));
      const next = buildLiveRun(run, previous, position, delay);
      if (next && !sameLiveRun(previous, next)) changed.push(next);
    }
    return changed;
  }

  /** The Run's latest Sighting per Source, without Sources that went quiet for too long. */
  private currentSightings(key: string): Sighting[] {
    const all = [...(this.sightings.get(key)?.values() ?? [])];
    if (all.length === 0) return [];
    const newest = Math.max(...all.map((s) => s.observedAt.getTime()));
    return all.filter((s) => s.observedAt.getTime() >= newest - this.sightingMaxAgeMs);
  }
}

function mergeRun(previous: Run, update: Run): Run {
  return createRun({ ...previous, ...update, id: update.id });
}

function buildLiveRun(
  run: Run | undefined,
  previous: LiveRun | undefined,
  livePosition: LivePosition | undefined,
  delay: Delay | undefined,
): LiveRun | undefined {
  const sighting = livePosition?.sighting;
  const serviceType: ServiceType | undefined = run?.serviceType ?? previous?.serviceType;
  if (!serviceType) return undefined;
  const runId = sighting?.runId ?? delay?.runId ?? previous?.runId;
  if (!runId) return undefined;
  const lineCode = run?.lineCode ?? previous?.lineCode;
  const delaySeconds = delay?.seconds ?? previous?.delaySeconds;

  const position =
    livePosition && sighting?.lat !== undefined && sighting.lon !== undefined
      ? {
          lat: sighting.lat,
          lon: sighting.lon,
          status: STATUS_OF[sighting.status],
          nextStationCode: sighting.stationCode,
          sources: livePosition.sources,
          observedAt: sighting.observedAt,
        }
      : previous && {
          lat: previous.lat,
          lon: previous.lon,
          status: previous.status,
          nextStationCode: previous.nextStationCode,
          sources: previous.sources,
          observedAt: previous.observedAt,
        };
  if (!position) return undefined;

  return {
    runId,
    serviceType,
    ...(lineCode !== undefined && { lineCode }),
    lat: position.lat,
    lon: position.lon,
    status: position.status,
    ...(delaySeconds !== undefined && { delaySeconds }),
    ...(position.nextStationCode !== undefined && { nextStationCode: position.nextStationCode }),
    sources: position.sources,
    observedAt: position.observedAt,
  };
}

function sameLiveRun(a: LiveRun | undefined, b: LiveRun): boolean {
  return (
    a !== undefined &&
    a.serviceType === b.serviceType &&
    a.lineCode === b.lineCode &&
    a.lat === b.lat &&
    a.lon === b.lon &&
    a.status === b.status &&
    a.delaySeconds === b.delaySeconds &&
    a.nextStationCode === b.nextStationCode &&
    a.observedAt.getTime() === b.observedAt.getTime() &&
    a.sources.join() === b.sources.join()
  );
}
