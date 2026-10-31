import { z } from 'zod';
import { ServiceDate } from './service-date.js';
import { TrainNumber } from './train-number.js';

/** Identifies a Run: train number + service date. */
export const RunId = z.object({
  trainNumber: TrainNumber,
  serviceDate: ServiceDate,
});
export type RunId = z.infer<typeof RunId>;

/** A Station's Renfe code. */
export const StationCode = z.string().min(1);
export type StationCode = z.infer<typeof StationCode>;

/** A Line's code, e.g. `C1`. */
export const LineCode = z.string().min(1);
export type LineCode = z.infer<typeof LineCode>;

/** A timestamp with an explicit UTC offset. */
export const Timestamp = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof Timestamp>;
