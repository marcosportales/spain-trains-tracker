import type { SearchResult } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  moveActive,
  normaliseQuery,
  optionHref,
  SEARCH_MIN_QUERY_LENGTH,
  type SearchOption,
  searchOptions,
} from './search-view';

const result: SearchResult = {
  query: 'c1',
  runs: [{ trainNumber: '12345', serviceDate: '2026-11-01', serviceType: 'cercanias' }],
  stations: [{ stationCode: '60000', name: 'Madrid Atocha' }],
  lines: [{ lineCode: 'C1', name: 'C1', serviceType: 'cercanias' }],
};

describe('normaliseQuery', () => {
  it('trims and reports whether the query is long enough to search', () => {
    expect(normaliseQuery('  c1 ')).toEqual({ query: 'c1', searchable: true });
    expect(normaliseQuery(' c ')).toEqual({ query: 'c', searchable: false });
    expect(SEARCH_MIN_QUERY_LENGTH).toBe(2);
  });
});

describe('searchOptions', () => {
  it('flattens groups in Line, Station, Run order with stable ids', () => {
    expect(searchOptions(result).map((o) => [o.kind, o.id])).toEqual([
      ['line', 'line:C1'],
      ['station', 'station:60000'],
      ['run', 'run:2026-11-01:12345'],
    ]);
  });

  it('is empty for no hits', () => {
    expect(searchOptions({ query: 'zz', runs: [], stations: [], lines: [] })).toEqual([]);
  });
});

describe('optionHref', () => {
  const [line, station, run] = searchOptions(result) as [SearchOption, SearchOption, SearchOption];
  it('applies the Line filter on the map', () => expect(optionHref(line)).toBe('/?line=C1'));
  it('opens the Station board', () => expect(optionHref(station)).toBe('/stations/60000'));
  it('opens the Run detail', () => expect(optionHref(run)).toBe('/runs/2026-11-01/12345'));
});

describe('moveActive', () => {
  it('wraps around and starts from the ends', () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(-1, 1, 0)).toBe(-1);
  });
});
