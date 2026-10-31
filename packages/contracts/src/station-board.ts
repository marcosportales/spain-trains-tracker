import { z } from 'zod';
import { LineCode, StationCode, Timestamp } from './run-id.js';
import { ServiceDate } from './service-date.js';
import { ServiceType } from './service-type.js';
import { TrainNumber } from './train-number.js';

/** One departure or arrival row on a Station board. */
export const StationBoardEntry = z.object({
  trainNumber: TrainNumber,
  serviceDate: ServiceDate,
  serviceType: ServiceType,
  lineCode: LineCode.optional(),
  /** The other end of the Run: destination for departures, origin for arrivals. */
  counterpartStationCode: StationCode,
  scheduledAt: Timestamp,
  estimatedAt: Timestamp.optional(),
  delaySeconds: z.number().int().optional(),
});
export type StationBoardEntry = z.infer<typeof StationBoardEntry>;

export const StationBoard = z.object({
  stationCode: StationCode,
  stationName: z.string().min(1),
  departures: z.array(StationBoardEntry),
  arrivals: z.array(StationBoardEntry),
});
export type StationBoard = z.infer<typeof StationBoard>;
