import type { LiveRun } from '@stt/contracts';
import { type LngLat, type Motion, makeMotion, type TrackPaths } from './interpolation';

/** Matches the ingest poll interval (`FEED_POLL_INTERVAL_MS`): a Run reaches its position as the next arrives. */
export const POLL_INTERVAL_MS = 20_000;

type Entry = { target: LngLat; motion: Motion; startedAt: number; moving: boolean };

type Options = {
  durationMs?: number;
  /** Track geometry by Line code. */
  paths?: ReadonlyMap<string, TrackPaths>;
  /** Users who prefer reduced motion see Runs jump to each new position. */
  reducedMotion?: boolean;
};

/**
 * Where each live Run is drawn over time. Every position update starts a motion from wherever the
 * Run is currently drawn, so a Run never jumps even when updates arrive mid-motion.
 */
export class RunMotions {
  private readonly entries = new Map<string, Entry>();
  private readonly durationMs: number;
  private readonly paths: ReadonlyMap<string, TrackPaths>;
  private readonly reducedMotion: boolean;

  constructor({
    durationMs = POLL_INTERVAL_MS,
    paths = new Map(),
    reducedMotion = false,
  }: Options = {}) {
    this.durationMs = durationMs;
    this.paths = paths;
    this.reducedMotion = reducedMotion;
  }

  update(runs: ReadonlyMap<string, LiveRun>, now: number): void {
    for (const key of this.entries.keys()) if (!runs.has(key)) this.entries.delete(key);
    for (const [key, run] of runs) {
      const target: LngLat = [run.lon, run.lat];
      const previous = this.entries.get(key);
      if (!previous) {
        this.entries.set(key, { target, motion: () => target, startedAt: now, moving: false });
      } else if (previous.target[0] !== target[0] || previous.target[1] !== target[1]) {
        const from = this.positionOf(previous, now);
        const motion = this.reducedMotion
          ? () => target
          : makeMotion({
              from,
              to: target,
              serviceType: run.serviceType,
              paths: run.lineCode ? this.paths.get(run.lineCode) : undefined,
            });
        this.entries.set(key, {
          target,
          motion,
          startedAt: now,
          moving: !this.reducedMotion,
        });
      }
    }
  }

  positionsAt(now: number): Map<string, LngLat> {
    return new Map([...this.entries].map(([key, entry]) => [key, this.positionOf(entry, now)]));
  }

  isAnimating(now: number): boolean {
    for (const entry of this.entries.values())
      if (entry.moving && now - entry.startedAt < this.durationMs) return true;
    return false;
  }

  private positionOf(entry: Entry, now: number): LngLat {
    return entry.motion((now - entry.startedAt) / this.durationMs);
  }
}
