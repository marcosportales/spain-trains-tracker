/** Health of one polled Official feed, as seen by the worker. */
export interface FeedHealth {
  readonly feed: string;
  readonly lastSuccessAt: Date | null;
  readonly lastError: string | null;
  readonly consecutiveFailures: number;
}

/** Exposes the health of every polled feed (read by the API's `/health`). */
export abstract class FeedHealthSource {
  abstract snapshot(): FeedHealth[];
}
