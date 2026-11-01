import type { FeedHealth } from './feed-health.source.js';

/** Shared record of feed health: the worker writes it, the API reads it (they are separate processes). */
export abstract class FeedHealthStore {
  abstract save(feeds: readonly FeedHealth[]): Promise<void>;
  /** Rejects when the store (the database) cannot be reached. */
  abstract list(): Promise<FeedHealth[]>;
}
