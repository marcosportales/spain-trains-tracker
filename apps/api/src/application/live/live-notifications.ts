/** Tells the API that the worker finished an ingest cycle (the read side of `LiveUpdatesPublisher`). */
export abstract class LiveNotifications {
  /** Calls `onCycle` with the id of each finished cycle. Resolves to a function that stops listening. */
  abstract listen(onCycle: (cycleId: number) => void): Promise<() => Promise<void>>;
}
