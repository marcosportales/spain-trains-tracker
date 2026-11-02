// @vitest-environment jsdom
import type { LiveRun } from '@stt/contracts';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type LiveRunFilters,
  type LiveRunsState,
  liveStreamUrl,
  useLiveRuns,
} from './use-live-runs';

describe('liveStreamUrl', () => {
  it('targets /live/stream without a query when unfiltered', () => {
    expect(liveStreamUrl({}, 'http://api')).toBe('http://api/live/stream');
  });

  it('encodes only the filters that are set', () => {
    expect(liveStreamUrl({ serviceType: 'ave', hub: undefined, line: 'C1' }, 'http://api')).toBe(
      'http://api/live/stream?serviceType=ave&line=C1',
    );
  });
});

class FakeEventSource {
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = 1;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, ((e: Event) => void)[]>();
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (e: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
  emit(type: string, data: string) {
    for (const listener of this.listeners.get(type) ?? [])
      listener(new MessageEvent(type, { data }));
  }
}

const RUN = {
  trainNumber: '03063',
  serviceDate: '2026-11-01',
  serviceType: 'ave',
  lon: -3.7,
  lat: 40.4,
  status: 'in_transit_to',
  delaySeconds: 0,
} as unknown as LiveRun;

let latest: LiveRunsState;

function Probe({ filters }: { filters: LiveRunFilters }) {
  latest = useLiveRuns(filters);
  return null;
}

describe('useLiveRuns', () => {
  let root: Root;
  const render = (filters: LiveRunFilters = {}) =>
    act(() => root.render(<Probe filters={filters} />));
  const stream = () => FakeEventSource.instances.at(-1) as FakeEventSource;
  const emit = (type: string, data: unknown) =>
    act(() => stream().emit(type, typeof data === 'string' ? data : JSON.stringify(data)));

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    root = createRoot(document.createElement('div'));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('starts with no event yet, opened now', async () => {
    await render();
    expect(latest.runs.size).toBe(0);
    expect(latest.lastEventAt).toBeUndefined();
    expect(latest.openedAt).toBe(1_000_000);
  });

  it('stamps lastEventAt on a snapshot', async () => {
    await render();
    vi.setSystemTime(1_005_000);
    await emit('snapshot', { cycleId: 1, generatedAt: 'x', runs: [RUN] });
    expect(latest.runs.size).toBe(1);
    expect(latest.lastEventAt).toBe(1_005_000);
  });

  it('stamps lastEventAt on a diff', async () => {
    await render();
    vi.setSystemTime(1_010_000);
    await emit('diff', { cycleId: 2, generatedAt: 'x', upserted: [RUN], removed: [] });
    expect(latest.runs.size).toBe(1);
    expect(latest.lastEventAt).toBe(1_010_000);
  });

  it('stamps lastEventAt on a heartbeat without touching the Runs', async () => {
    await render();
    await emit('snapshot', { cycleId: 1, generatedAt: 'x', runs: [RUN] });
    const runs = latest.runs;
    vi.setSystemTime(1_015_000);
    await emit('heartbeat', '{}');
    expect(latest.lastEventAt).toBe(1_015_000);
    expect(latest.runs).toBe(runs);
  });

  it('ignores a malformed event', async () => {
    await render();
    await emit('snapshot', 'not json');
    await emit('diff', { upserted: 'nope' });
    expect(latest.lastEventAt).toBeUndefined();
  });

  it('restarts the stream and clears the clock when the filters change', async () => {
    await render();
    await emit('snapshot', { cycleId: 1, generatedAt: 'x', runs: [RUN] });
    const first = stream();
    vi.setSystemTime(1_060_000);
    await render({ hub: 'madrid' });
    expect(first.readyState).toBe(FakeEventSource.CLOSED);
    expect(stream().url).toContain('hub=madrid');
    expect(latest.runs.size).toBe(0);
    expect(latest.lastEventAt).toBeUndefined();
    expect(latest.openedAt).toBe(1_060_000);
  });
});
