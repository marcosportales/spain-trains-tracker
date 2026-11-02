import { z } from 'zod';
import { RunStatus, Source } from './live-run.js';
import { StationCode, Timestamp } from './run-id.js';
import { ServiceDate } from './service-date.js';
import { ServiceType } from './service-type.js';
import { TrainNumber } from './train-number.js';

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

/** Which Run this is: the identity every Run has, tracked or scheduled. */
export const RunIdentity = z.object({
  trainNumber: TrainNumber,
  serviceDate: ServiceDate,
  serviceType: ServiceType,
  lineCode: z.string().min(1).optional(),
});
export type RunIdentity = z.infer<typeof RunIdentity>;

/** Where a Tracked Run is, from its latest positioned Sighting. */
export const RunPosition = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  status: RunStatus,
  nextStationCode: z.string().min(1).optional(),
  sources: z
    .array(Source)
    .min(1)
    .refine((s) => new Set(s).size === s.length, 'sources must be unique'),
  observedAt: z.iso.datetime({ offset: true }),
});
export type RunPosition = z.infer<typeof RunPosition>;

/**
 * A Run with its scheduled stops, latest Delay, accessibility and Rolling stock. Without
 * `position` it is a Scheduled Run: known from the timetable, not seen on the map yet.
 */
export const RunDetail = z.object({
  run: RunIdentity,
  position: RunPosition.optional(),
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
