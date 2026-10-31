import { z } from 'zod';
import { ServiceDate } from './service-date.js';
import { ServiceType } from './service-type.js';
import { TrainNumber } from './train-number.js';

/** Where a Sighting came from: the Official feed or the optional Visor feed. */
export const Source = z.enum(['official', 'visor']);
export type Source = z.infer<typeof Source>;

/** Position of a Run relative to its next Station (mirrors GTFS-RT `currentStatus`). */
export const RunStatus = z.enum(['incoming_at', 'stopped_at', 'in_transit_to']);
export type RunStatus = z.infer<typeof RunStatus>;

/** The latest known state of a Run, identified by train number + service date. */
export const LiveRun = z.object({
  trainNumber: TrainNumber,
  serviceDate: ServiceDate,
  serviceType: ServiceType,
  lineCode: z.string().min(1).optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  status: RunStatus,
  delaySeconds: z.number().int().optional(),
  nextStationCode: z.string().min(1).optional(),
  sources: z
    .array(Source)
    .min(1)
    .refine((s) => new Set(s).size === s.length, 'sources must be unique'),
  observedAt: z.iso.datetime({ offset: true }),
});
export type LiveRun = z.infer<typeof LiveRun>;
