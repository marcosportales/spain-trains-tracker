import { z } from 'zod';
import { RunStatus, Source } from './live-run.js';
import { StationCode, Timestamp } from './run-id.js';
import { ServiceDate } from './service-date.js';
import { TrainNumber } from './train-number.js';

/** One reported position of a Run at an instant, as replayed from history. */
export const WindowSighting = z.object({
  trainNumber: TrainNumber,
  serviceDate: ServiceDate,
  source: Source,
  observedAt: Timestamp,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  status: RunStatus,
  stationCode: StationCode.optional(),
  platform: z.string().min(1).optional(),
  /** Whether the position was snapped onto the Line geometry rather than reported raw. */
  positionIsSnapped: z.boolean(),
});
export type WindowSighting = z.infer<typeof WindowSighting>;

/** Sightings with a position in `[from, to)`, at most one per Run, Source and `stepSeconds` bucket. */
export const SightingWindow = z.object({
  from: Timestamp,
  to: Timestamp,
  stepSeconds: z.number().int().positive(),
  /** Oldest first. */
  sightings: z.array(WindowSighting),
});
export type SightingWindow = z.infer<typeof SightingWindow>;
