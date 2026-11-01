import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LiveDiff, LiveSnapshot } from '@stt/contracts';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../test/support/test-database.js';
import { GetLiveSnapshot } from '../../application/live/get-live-snapshot.use-case.js';
import { LiveStream } from '../../application/live/live-stream.js';
import { createRun, createRunId, createSighting } from '../../domain/movement/index.js';
import { DrizzleLiveRunsReader } from '../db/drizzle-live-runs.reader.js';
import { DrizzleMovementRepository } from '../db/drizzle-movement.repository.js';
import { DrizzleNetworkRepository } from '../db/drizzle-network.repository.js';
import { PostgresLiveNotifications } from '../db/postgres-live-notifications.js';
import { PostgresLiveUpdatesPublisher } from '../db/postgres-live-updates.publisher.js';
import * as t from '../db/schema/index.js';
import { LIVE_STREAM_HEARTBEAT_MS, LiveController } from './live.controller.js';

type Message = { event?: string; data?: string; comment?: string };

/** A minimal SSE client over fetch. */
async function connect(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal });
  const messages: Message[] = [];
  let waiting: (() => void) | undefined;
  const pump = (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        let end = buffer.indexOf('\n\n');
        while (end !== -1) {
          const message: Message = {};
          for (const line of buffer.slice(0, end).split('\n')) {
            if (line.startsWith(':')) message.comment = line.slice(1).trim();
            else if (line.startsWith('event: ')) message.event = line.slice(7);
            else if (line.startsWith('data: ')) message.data = line.slice(6);
          }
          messages.push(message);
          waiting?.();
          buffer = buffer.slice(end + 2);
          end = buffer.indexOf('\n\n');
        }
      }
    } catch {
      // aborted
    }
  })();
  const next = async (match: (m: Message) => boolean, timeoutMs = 3000): Promise<Message> => {
    const deadline = Date.now() + timeoutMs;
    let seen = 0;
    for (;;) {
      for (; seen < messages.length; seen++) {
        const m = messages[seen] as Message;
        if (match(m)) return m;
      }
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`timed out; got ${JSON.stringify(messages)}`);
      await new Promise<void>((resolve) => {
        waiting = resolve;
        setTimeout(resolve, left);
      });
    }
  };
  return { res, messages, next, pump };
}

describe('GET /live/stream', () => {
  let testDb: TestDatabase;
  let app: INestApplication;
  let url: string;
  let liveStream: LiveStream;
  let movement: DrizzleMovementRepository;
  let publisher: PostgresLiveUpdatesPublisher;
  let aborts: AbortController[] = [];

  beforeAll(async () => {
    testDb = await createTestDatabase();
    movement = new DrizzleMovementRepository(testDb.db);
    // A private channel: NOTIFY is database-wide, and other test files listen on `live_runs`.
    const channel = `live_runs_${testDb.schema}`;
    publisher = new PostgresLiveUpdatesPublisher(testDb.db, channel);
    const network = new DrizzleNetworkRepository(testDb.db);
    const snapshot = new GetLiveSnapshot(new DrizzleLiveRunsReader(testDb.db), network);
    liveStream = new LiveStream(
      new PostgresLiveNotifications(testDb.sql, channel),
      snapshot,
      network,
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveController],
      providers: [
        { provide: GetLiveSnapshot, useValue: snapshot },
        { provide: LiveStream, useValue: liveStream },
        { provide: LIVE_STREAM_HEARTBEAT_MS, useValue: 100 },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    url = `${await app.getUrl()}/live/stream`.replace('[::1]', 'localhost');
  });
  afterAll(async () => {
    await liveStream.close();
    await app.close();
    await testDb.close();
  });
  beforeEach(async () => {
    await testDb.sql.unsafe(
      'TRUNCATE sightings, delays, runs, lines, hubs RESTART IDENTITY CASCADE',
    );
    await testDb.db.insert(t.hubs).values({ code: '10', name: 'Madrid' });
    await testDb.db.insert(t.lines).values([
      { code: '10-C1', name: 'C1 Madrid', serviceType: 'cercanias', hubCode: '10' },
      { code: 'AVE-MS', name: 'AVE Madrid-Sevilla', serviceType: 'ave' },
    ]);
  });
  afterEach(() => {
    for (const abort of aborts) abort.abort();
    aborts = [];
  });

  const open = (query = '') => {
    const abort = new AbortController();
    aborts.push(abort);
    return connect(`${url}${query}`, abort.signal);
  };

  async function insertRun(trainNumber: string, serviceType: 'ave' | 'cercanias', line: string) {
    const id = createRunId(trainNumber, '2026-10-31');
    await movement.touchRuns([createRun({ id, serviceType, lineCode: line })], new Date());
    await movement.saveSightings([
      createSighting({
        runId: id,
        source: 'gtfsrt_ld',
        observedAt: new Date(),
        lat: 40.4,
        lon: -3.7,
        status: 'IN_TRANSIT_TO',
      }),
    ]);
  }

  it('sends a snapshot on connect, then a diff within 1 s of a NOTIFY', async () => {
    await insertRun('100', 'ave', 'AVE-MS');
    const client = await open();
    expect(client.res.status).toBe(200);
    expect(client.res.headers.get('content-type')).toContain('text/event-stream');

    const snapshot = await client.next((m) => m.event === 'snapshot');
    expect(LiveSnapshot.parse(JSON.parse(snapshot.data as string)).runs).toHaveLength(1);

    await insertRun('200', 'ave', 'AVE-MS');
    const notifiedAt = Date.now();
    await publisher.publish({ cycleId: 42, upserted: [] });

    const diff = await client.next((m) => m.event === 'diff', 1000);
    expect(Date.now() - notifiedAt).toBeLessThan(1000);
    const parsed = LiveDiff.parse(JSON.parse(diff.data as string));
    expect(parsed.cycleId).toBe(42);
    expect(parsed.upserted.map((r) => r.trainNumber)).toEqual(['00200']);
    expect(parsed.removed).toEqual([]);
  });

  it('applies the filters to the snapshot and its diffs', async () => {
    const client = await open('?serviceType=cercanias');
    await client.next((m) => m.event === 'snapshot');
    await insertRun('100', 'ave', 'AVE-MS');
    await insertRun('200', 'cercanias', '10-C1');
    await publisher.publish({ cycleId: 1, upserted: [] });
    const diff = await client.next((m) => m.event === 'diff');
    expect(
      JSON.parse(diff.data as string).upserted.map((r: { trainNumber: string }) => r.trainNumber),
    ).toEqual(['00200']);
  });

  it('answers 400 to an unknown filter and to bad queries', async () => {
    for (const query of ['?hub=99', '?line=NOPE', '?serviceType=tram', '?colour=red']) {
      const res = await fetch(`${url}${query}`);
      expect(res.status, query).toBe(400);
      expect(res.headers.get('content-type')).toContain('application/json');
    }
  });

  it('sends a heartbeat comment while idle', async () => {
    const client = await open();
    await client.next((m) => m.comment === 'heartbeat');
  });

  it('releases the LISTEN when the last client disconnects', async () => {
    const countListeners = async () =>
      Number(
        (
          await testDb.sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE query LIKE ${`listen %${testDb.schema}%`}`
        )[0]?.n,
      );
    const client = await open();
    await client.next((m) => m.event === 'snapshot');
    expect(await countListeners()).toBe(1);

    aborts[0]?.abort();
    await client.pump;
    const deadline = Date.now() + 2000;
    while ((await countListeners()) !== 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(await countListeners()).toBe(0);

    // A new client works again.
    const again = await open();
    await again.next((m) => m.event === 'snapshot');
  });
});
