import type { LiveDiff, LiveRun, LiveSnapshot } from '@stt/contracts';
import type { NetworkRepository } from '../network/network.repository.js';
import type { GetLiveSnapshot, LiveSnapshotQuery } from './get-live-snapshot.use-case.js';
import type { LiveNotifications } from './live-notifications.js';

/** What a client of the live stream receives: a snapshot first, then a diff per changed cycle. */
export type LiveStreamEvent =
  | { readonly type: 'snapshot'; readonly data: LiveSnapshot }
  | { readonly type: 'diff'; readonly data: LiveDiff };

type Send = (event: LiveStreamEvent) => void;

interface Client {
  readonly matches: (run: LiveRun) => boolean;
  readonly send: Send;
  readonly end: () => void;
  /** Keys of the Runs this client has been told about. */
  readonly known: Set<string>;
  /** Diffs that arrived before the snapshot was sent. */
  pending: LiveDiff[] | undefined;
}

const keyOf = (run: { trainNumber: string; serviceDate: string }) =>
  `${run.serviceDate}:${run.trainNumber}`;

/**
 * Fans live Run changes out to many clients. It holds a single `LISTEN` while anyone is connected;
 * on every finished ingest cycle it reads the live Runs once, diffs them against the previous
 * cycle, and gives each client the part of the diff that matches its filters.
 */
export class LiveStream {
  private stopListening: (() => Promise<void>) | undefined;
  private starting: Promise<void> | undefined;
  private baseline = new Map<string, LiveRun>();
  private queue: Promise<void> = Promise.resolve();
  private readonly clients = new Set<Client>();

  constructor(
    private readonly notifications: LiveNotifications,
    private readonly snapshots: GetLiveSnapshot,
    private readonly network: NetworkRepository,
    private readonly onError: (error: unknown) => void = () => {},
  ) {}

  /**
   * Sends the current snapshot, then the diffs of later cycles, to `send`.
   * Throws `UnknownLiveFilterError` for a Hub or Line that does not exist.
   * Returns the function that disconnects the client.
   */
  async subscribe(
    query: LiveSnapshotQuery,
    send: Send,
    end: () => void = () => {},
  ): Promise<() => void> {
    const matches = await this.matcherFor(query);
    const client: Client = { matches, send, end, known: new Set(), pending: [] };
    this.clients.add(client);
    const unsubscribe = () => this.remove(client);
    try {
      await this.start();
      const snapshot = await this.snapshots.execute(query);
      if (!this.clients.has(client)) return unsubscribe;
      for (const run of snapshot.runs) client.known.add(keyOf(run));
      send({ type: 'snapshot', data: snapshot });
      const pending = client.pending ?? [];
      client.pending = undefined;
      for (const diff of pending) this.deliver(client, diff);
    } catch (error) {
      this.clients.delete(client);
      if (this.clients.size === 0) await this.stop();
      throw error;
    }
    return unsubscribe;
  }

  /** Resolves once every notification received so far has been handled. */
  async idle(): Promise<void> {
    await this.queue;
  }

  /** Ends every client's stream and stops listening. */
  async close(): Promise<void> {
    const clients = [...this.clients];
    this.clients.clear();
    for (const client of clients) client.end();
    await this.stop();
  }

  private remove(client: Client): void {
    this.clients.delete(client);
    if (this.clients.size === 0) void this.stop();
  }

  private async start(): Promise<void> {
    this.starting ??= this.listen().catch((error) => {
      this.starting = undefined;
      throw error;
    });
    await this.starting;
  }

  private async listen(): Promise<void> {
    this.stopListening = await this.notifications.listen((cycleId) => {
      this.queue = this.queue.then(() => this.handleCycle(cycleId)).catch(this.onError);
    });
    try {
      this.baseline = await this.readAll();
    } catch (error) {
      const stop = this.stopListening;
      this.stopListening = undefined;
      await stop?.();
      throw error;
    }
  }

  private async stop(): Promise<void> {
    const starting = this.starting;
    this.starting = undefined;
    if (!starting) return;
    await starting.catch(() => {});
    const stop = this.stopListening;
    this.stopListening = undefined;
    await stop?.();
  }

  private async readAll(): Promise<Map<string, LiveRun>> {
    const { runs } = await this.snapshots.execute({});
    return new Map(runs.map((run) => [keyOf(run), run]));
  }

  private async handleCycle(cycleId: number): Promise<void> {
    if (this.clients.size === 0) return;
    const current = await this.readAll();
    const upserted = [...current].filter(
      ([key, run]) => JSON.stringify(this.baseline.get(key)) !== JSON.stringify(run),
    );
    const removed = [...this.baseline]
      .filter(([key]) => !current.has(key))
      .map(([, { trainNumber, serviceDate }]) => ({ trainNumber, serviceDate }));
    this.baseline = current;
    if (upserted.length === 0 && removed.length === 0) return;
    const diff: LiveDiff = { cycleId, upserted: upserted.map(([, run]) => run), removed };
    for (const client of this.clients) {
      if (client.pending) client.pending.push(diff);
      else this.deliver(client, diff);
    }
  }

  private deliver(client: Client, diff: LiveDiff): void {
    const upserted = diff.upserted.filter(client.matches);
    for (const run of upserted) client.known.add(keyOf(run));
    const removed = diff.removed.filter((id) => client.known.delete(keyOf(id)));
    if (upserted.length === 0 && removed.length === 0) return;
    client.send({ type: 'diff', data: { cycleId: diff.cycleId, upserted, removed } });
  }

  private async matcherFor(query: LiveSnapshotQuery): Promise<(run: LiveRun) => boolean> {
    let hubLines: Set<string> | undefined;
    if (query.hubCode !== undefined) {
      const lines = await this.network.listLines();
      hubLines = new Set(lines.filter((l) => l.hubCode === query.hubCode).map((l) => l.code));
    }
    return (run) =>
      (query.serviceType === undefined || run.serviceType === query.serviceType) &&
      (query.lineCode === undefined || run.lineCode === query.lineCode) &&
      (hubLines === undefined || (run.lineCode !== undefined && hubLines.has(run.lineCode)));
  }
}
