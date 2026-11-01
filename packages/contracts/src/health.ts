import { z } from 'zod';
import { Timestamp } from './run-id.js';

/** Health of one polled feed, as last reported by the worker. */
export const FeedHealthDto = z.object({
  feed: z.string().min(1),
  /** Null until the feed has been polled successfully once. */
  lastSuccessAt: Timestamp.nullable(),
  lastError: z.string().nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
});
export type FeedHealthDto = z.infer<typeof FeedHealthDto>;

/** `GET /health`: `down` (with HTTP 503) when the database cannot be reached. */
export const HealthDto = z.object({
  status: z.enum(['ok', 'down']),
  database: z.enum(['up', 'down']),
  feeds: z.array(FeedHealthDto),
});
export type HealthDto = z.infer<typeof HealthDto>;
