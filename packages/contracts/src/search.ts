import { z } from 'zod';
import { LineCode, StationCode } from './run-id.js';
import { ServiceDate } from './service-date.js';
import { ServiceType } from './service-type.js';
import { TrainNumber } from './train-number.js';

export const RunSearchHit = z.object({
  trainNumber: TrainNumber,
  serviceDate: ServiceDate,
  serviceType: ServiceType,
  lineCode: LineCode.optional(),
});
export type RunSearchHit = z.infer<typeof RunSearchHit>;

export const StationSearchHit = z.object({
  stationCode: StationCode,
  name: z.string().min(1),
});
export type StationSearchHit = z.infer<typeof StationSearchHit>;

export const LineSearchHit = z.object({
  lineCode: LineCode,
  name: z.string().min(1),
  serviceType: ServiceType,
});
export type LineSearchHit = z.infer<typeof LineSearchHit>;

/** Matches for a search query, grouped by kind. */
export const SearchResult = z.object({
  query: z.string(),
  runs: z.array(RunSearchHit),
  stations: z.array(StationSearchHit),
  lines: z.array(LineSearchHit),
});
export type SearchResult = z.infer<typeof SearchResult>;
