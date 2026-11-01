import type { LiveDiff, LiveRun, LiveSnapshot } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import type { NetworkRepository } from '../network/network.repository.js';
import type { GetLiveSnapshot } from './get-live-snapshot.use-case.js';
import { UnknownLiveFilterError } from './get-live-snapshot.use-case.js';
import { LiveNotifications } from './live-notifications.js';
import { LiveStream, type LiveStreamEvent } from './live-stream.js';

const run = (trainNumber: string, overrides: Partial<LiveRun> = {}): LiveRun => ({
  trainNumber: trainNumber.padStart(5, '0'),
  serviceDate: '2026-10-31',
  serviceType: 'ave',
  lat: 40,
  lon: -3,
  status: 'in_transit_to',
  sources: ['official'],
  observedAt: '2026-10-31T10:00:00.000Z',
  ...overrides,
});

class FakeNotifications extends LiveNotifications {
  listeners = 0;
  private callback?: (cycleId: number) => void;
  async listen(onCycle: (cycleId: number) => void) {
    this.listeners++;
    this.callback = onCycle;
    return async () => {
      this.listeners--;
    };
  }
  notify(cycleId: number) {
    this.callback?.(cycleId);
  }
}

/** Serves `current` for every query, applying the same filters as the real use case. */
class FakeSnapshots {
  current: LiveRun[] = [];
  calls = 0;
  execute = async (query: { serviceType?: string; lineCode?: string; hubCode?: string }) => {
    this.calls++;
    const runs = this.current.filter(
      (r) =>
        (!query.serviceType || r.serviceType === query.serviceType) &&
        (!query.lineCode || r.lineCode === query.lineCode),
    );
    return { cycleId: 1, generatedAt: '2026-10-31T10:00:00.000Z', runs } satisfies LiveSnapshot;
  };
}

const network = {
  listLines: async () => [
    { code: '10-C1', name: 'C1', serviceType: 'cercanias', hubCode: '10' },
    { code: '60-C2', name: 'C2', serviceType: 'cercanias', hubCode: '60' },
  ],
} as unknown as NetworkRepository;

function setup() {
  const notifications = new FakeNotifications();
  const snapshots = new FakeSnapshots();
  const stream = new LiveStream(notifications, snapshots as unknown as GetLiveSnapshot, network);
  const subscribe = async (query = {}) => {
    const events: LiveStreamEvent[] = [];
    const unsubscribe = await stream.subscribe(query, (event) => events.push(event));
    return { events, unsubscribe };
  };
  const cycle = async (cycleId: number) => {
    notifications.notify(cycleId);
    await stream.idle();
  };
  return { notifications, snapshots, stream, subscribe, cycle };
}

const diffs = (events: LiveStreamEvent[]) =>
  events.filter((e): e is Extract<LiveStreamEvent, { type: 'diff' }> => e.type === 'diff');

describe('LiveStream', () => {
  it('sends the snapshot first, then a diff per cycle with what changed', async () => {
    const { snapshots, subscribe, cycle } = setup();
    snapshots.current = [run('1'), run('2')];
    const { events } = await subscribe();
    expect(events.map((e) => e.type)).toEqual(['snapshot']);

    snapshots.current = [run('1', { lat: 41 }), run('3')];
    await cycle(7);

    expect(diffs(events)).toEqual([
      {
        type: 'diff',
        data: {
          cycleId: 7,
          upserted: [run('1', { lat: 41 }), run('3')],
          removed: [{ trainNumber: '00002', serviceDate: '2026-10-31' }],
        } satisfies LiveDiff,
      },
    ]);
  });

  it('sends nothing for a cycle that changed nothing', async () => {
    const { snapshots, subscribe, cycle } = setup();
    snapshots.current = [run('1')];
    const { events } = await subscribe();
    await cycle(2);
    expect(diffs(events)).toEqual([]);
  });

  it('listens once and computes the diff once per cycle, however many clients', async () => {
    const { notifications, snapshots, subscribe, cycle } = setup();
    const a = await subscribe();
    const b = await subscribe();
    const c = await subscribe({ serviceType: 'ave' });
    expect(notifications.listeners).toBe(1);

    snapshots.current = [run('1')];
    const before = snapshots.calls;
    await cycle(2);
    expect(snapshots.calls - before).toBe(1);
    for (const { events } of [a, b, c]) expect(diffs(events)).toHaveLength(1);
  });

  it('applies each client’s filters to its diffs', async () => {
    const { snapshots, subscribe, cycle } = setup();
    const ave = await subscribe({ serviceType: 'ave' });
    const madrid = await subscribe({ hubCode: '10' });
    const line = await subscribe({ lineCode: '60-C2' });

    snapshots.current = [
      run('1'),
      run('2', { serviceType: 'cercanias', lineCode: '10-C1' }),
      run('3', { serviceType: 'cercanias', lineCode: '60-C2' }),
    ];
    await cycle(2);

    const trains = (events: LiveStreamEvent[]) =>
      diffs(events).flatMap((d) => d.data.upserted.map((r) => r.trainNumber));
    expect(trains(ave.events)).toEqual(['00001']);
    expect(trains(madrid.events)).toEqual(['00002']);
    expect(trains(line.events)).toEqual(['00003']);
  });

  it('only reports removals of Runs the client was told about', async () => {
    const { snapshots, subscribe, cycle } = setup();
    snapshots.current = [run('1'), run('2', { serviceType: 'cercanias' })];
    const { events } = await subscribe({ serviceType: 'ave' });
    snapshots.current = [];
    await cycle(2);
    expect(diffs(events).map((d) => d.data.removed)).toEqual([
      [{ trainNumber: '00001', serviceDate: '2026-10-31' }],
    ]);
  });

  it('rejects an unknown filter without starting to listen', async () => {
    const { notifications, snapshots, stream } = setup();
    snapshots.execute = async () => {
      throw new UnknownLiveFilterError('hub', '99');
    };
    await expect(stream.subscribe({ hubCode: '99' }, () => {})).rejects.toBeInstanceOf(
      UnknownLiveFilterError,
    );
    expect(notifications.listeners).toBe(0);
  });

  it('stops listening when the last client leaves, and listens again for the next', async () => {
    const { notifications, subscribe } = setup();
    const a = await subscribe();
    const b = await subscribe();
    a.unsubscribe();
    expect(notifications.listeners).toBe(1);
    b.unsubscribe();
    await new Promise((resolve) => setImmediate(resolve));
    expect(notifications.listeners).toBe(0);
    await subscribe();
    expect(notifications.listeners).toBe(1);
  });

  it('sends nothing to a client that left', async () => {
    const { snapshots, subscribe, cycle } = setup();
    const gone = await subscribe();
    const stays = await subscribe();
    gone.unsubscribe();
    snapshots.current = [run('1')];
    await cycle(2);
    expect(diffs(gone.events)).toEqual([]);
    expect(diffs(stays.events)).toHaveLength(1);
  });

  it('keeps going after a cycle fails to read', async () => {
    const { snapshots, subscribe, cycle } = setup();
    const { events } = await subscribe();
    const ok = snapshots.execute;
    snapshots.execute = async () => {
      throw new Error('db down');
    };
    await cycle(2);
    snapshots.execute = ok;
    snapshots.current = [run('1')];
    await cycle(3);
    expect(diffs(events).map((d) => d.data.cycleId)).toEqual([3]);
  });
});
