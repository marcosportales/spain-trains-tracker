import { z } from 'zod';
import { LiveRun } from './live-run.js';
import { StationCode, Timestamp } from './run-id.js';

/** A scheduled Station stop of a Run, with the estimated time when known. */
export const RunStop = z.object({
  stationCode: StationCode,
  sequence: z.number().int().nonnegative(),
  scheduledArrival: Timestamp.optional(),
  scheduledDeparture: Timestamp.optional(),
  estimatedArrival: Timestamp.optional(),
  estimatedDeparture: Timestamp.optional(),
});
export type RunStop = z.infer<typeof RunStop>;

/** A Run with its scheduled stops, latest Delay and Rolling stock. */
export const RunDetail = z.object({
  run: LiveRun,
  stops: z.array(RunStop),
  delaySeconds: z.number().int().optional(),
  rollingStock: z.string().min(1).optional(),
});
export type RunDetail = z.infer<typeof RunDetail>;
