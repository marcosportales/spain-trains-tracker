import { z } from 'zod';
import { LiveRun } from './live-run.js';
import { RunId, Timestamp } from './run-id.js';

/** The ingest cycle that produced a snapshot or diff; increases monotonically. */
export const CycleId = z.number().int().nonnegative();
export type CycleId = z.infer<typeof CycleId>;

/** Every live Run at a given cycle. */
export const LiveSnapshot = z.object({
  cycleId: CycleId,
  generatedAt: Timestamp,
  runs: z.array(LiveRun),
});
export type LiveSnapshot = z.infer<typeof LiveSnapshot>;

/** Changes since the previous cycle: Runs added or updated, and Runs no longer live. */
export const LiveDiff = z.object({
  cycleId: CycleId,
  upserted: z.array(LiveRun),
  removed: z.array(RunId),
});
export type LiveDiff = z.infer<typeof LiveDiff>;
