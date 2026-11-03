import { describe, expect, it } from 'vitest';
import {
  addRecent,
  clearRecents,
  loadRecents,
  madridToday,
  RECENTS_KEY,
  RECENTS_LIMIT,
  type RecentsStorage,
} from './recents';
import type { SearchOption } from './search-view';

const TODAY = '2026-11-03';

const memory = (initial?: string): RecentsStorage & { value: string | undefined } => {
  const store = {
    value: initial,
    getItem: () => store.value ?? null,
    setItem: (_: string, v: string) => {
      store.value = v;
    },
    removeItem: () => {
      store.value = undefined;
    },
  };
  return store;
};

const station = (code: string): SearchOption => ({
  kind: 'station',
  id: `station:${code}`,
  hit: { stationCode: code, name: `S${code}` },
});
const run = (n: string, serviceDate = TODAY): SearchOption => ({
  kind: 'run',
  id: `run:${serviceDate}:${n}`,
  hit: { trainNumber: n, serviceDate, serviceType: 'ave' },
});
const line = (code: string): SearchOption => ({
  kind: 'line',
  id: `line:${code}`,
  hit: { lineCode: code, name: code, serviceType: 'cercanias' },
});

describe('addRecent', () => {
  it('puts the latest pick first and persists it', () => {
    const storage = memory();
    addRecent(storage, TODAY, station('1'));
    const next = addRecent(storage, TODAY, line('C1'));
    expect(next.map((o) => o.id)).toEqual(['line:C1', 'station:1']);
    expect(loadRecents(storage, TODAY).map((o) => o.id)).toEqual(['line:C1', 'station:1']);
  });

  it('moves a repeated pick to the top without duplicating it', () => {
    const storage = memory();
    for (const o of [station('1'), run('10'), station('1')]) addRecent(storage, TODAY, o);
    expect(loadRecents(storage, TODAY).map((o) => o.id)).toEqual(['station:1', `run:${TODAY}:10`]);
  });

  it('keeps at most 4, dropping the oldest', () => {
    const storage = memory();
    for (const c of ['1', '2', '3', '4', '5']) addRecent(storage, TODAY, station(c));
    const ids = loadRecents(storage, TODAY).map((o) => o.id);
    expect(RECENTS_LIMIT).toBe(4);
    expect(ids).toEqual(['station:5', 'station:4', 'station:3', 'station:2']);
  });

  it('survives a store that throws on write', () => {
    const storage: RecentsStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    expect(addRecent(storage, TODAY, station('1'))).toHaveLength(1);
  });
});

describe('loadRecents', () => {
  it('drops Runs from another Service date, keeps Stations and Lines', () => {
    const storage = memory(
      JSON.stringify([run('1', '2026-11-02'), station('1'), run('2'), line('C1')]),
    );
    expect(loadRecents(storage, TODAY).map((o) => o.id)).toEqual([
      'station:1',
      `run:${TODAY}:2`,
      'line:C1',
    ]);
  });

  it('treats corrupt content as no Recents', () => {
    expect(loadRecents(memory('{not json'), TODAY)).toEqual([]);
    expect(loadRecents(memory('{"a":1}'), TODAY)).toEqual([]);
    expect(
      loadRecents(memory(JSON.stringify([null, 3, { kind: 'x' }, { kind: 'run' }])), TODAY),
    ).toEqual([]);
  });

  it('treats a blocked store as no Recents', () => {
    const blocked: RecentsStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadRecents(blocked, TODAY)).toEqual([]);
    expect(loadRecents(undefined, TODAY)).toEqual([]);
  });
});

describe('clearRecents', () => {
  it('empties the store', () => {
    const storage = memory();
    addRecent(storage, TODAY, station('1'));
    clearRecents(storage);
    expect(storage.value).toBeUndefined();
    expect(loadRecents(storage, TODAY)).toEqual([]);
    expect(RECENTS_KEY).toBeTruthy();
  });
});

describe('madridToday', () => {
  it('uses the Madrid calendar day', () => {
    expect(madridToday(new Date('2026-11-02T23:30:00Z'))).toBe('2026-11-03');
    expect(madridToday(new Date('2026-11-03T22:59:00Z'))).toBe('2026-11-03');
  });
});
