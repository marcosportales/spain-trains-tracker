import { z } from 'zod';
import { StationCode } from './run-id.js';

/** A Station with its position, as drawn on the map. */
export const StationSummary = z.object({
  code: StationCode,
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type StationSummary = z.infer<typeof StationSummary>;

export const StationList = z.array(StationSummary);
export type StationList = z.infer<typeof StationList>;
