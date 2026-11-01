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

/** Whether a Run is going ahead as timetabled or has been called off. */
export const ServiceStatus = z.enum(['scheduled', 'cancelled']);
export type ServiceStatus = z.infer<typeof ServiceStatus>;

/** A Run with its scheduled stops, latest Delay, accessibility and Rolling stock. */
export const RunDetail = z.object({
  run: LiveRun,
  /** Where the Run starts and ends: its first and last scheduled stop. */
  originStationCode: StationCode.optional(),
  destinationStationCode: StationCode.optional(),
  serviceStatus: ServiceStatus.optional(),
  wheelchairAccessible: z.boolean().optional(),
  stops: z.array(RunStop),
  delaySeconds: z.number().int().optional(),
  rollingStock: z.string().min(1).optional(),
});
export type RunDetail = z.infer<typeof RunDetail>;
