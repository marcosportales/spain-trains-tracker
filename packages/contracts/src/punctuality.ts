import { z } from 'zod';
import { HubCode } from './hub-code.js';
import { LineCode } from './run-id.js';
import { ServiceType } from './service-type.js';

/** How one Line performed over the ranking window. */
export const LinePunctuality = z.object({
  lineCode: LineCode,
  name: z.string().min(1),
  serviceType: ServiceType,
  hubCode: HubCode.optional(),
  /** Delay observations behind the figures. */
  observations: z.number().int().positive(),
  /** Share of observations with a Delay of at most 5 min (early counts as on time), 0–100. */
  onTimePct: z.number().min(0).max(100),
  /** Average Delay in seconds; negative when Runs are early on average. */
  avgSeconds: z.number(),
});
export type LinePunctuality = z.infer<typeof LinePunctuality>;

/** Lines ranked from least to most punctual. Lines with too few observations are left out. */
export const PunctualityRanking = z.object({
  days: z.number().int().positive(),
  lines: z.array(LinePunctuality),
});
export type PunctualityRanking = z.infer<typeof PunctualityRanking>;

/** Delay for one hour of the day (Madrid time), pooled over the window. */
export const HourPunctuality = z.object({
  hour: z.number().int().min(0).max(23),
  observations: z.number().int().nonnegative(),
  /** Null when there are no observations in that hour. */
  avgSeconds: z.number().nullable(),
  onTimePct: z.number().min(0).max(100).nullable(),
});
export type HourPunctuality = z.infer<typeof HourPunctuality>;

/** Delay by hour of day: always 24 entries, hours 0–23. */
export const DelayByHour = z.object({
  days: z.number().int().positive(),
  lineCode: LineCode.optional(),
  hours: z.array(HourPunctuality).length(24),
});
export type DelayByHour = z.infer<typeof DelayByHour>;
