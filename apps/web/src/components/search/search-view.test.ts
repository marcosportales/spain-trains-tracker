import type { SearchResult, SearchSuggestions } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  FIXED_STATIONS,
  moveActive,
  normaliseQuery,
  optionHref,
  runRouteText,
  SEARCH_GROUP_LIMIT,
  SEARCH_MIN_QUERY_LENGTH,
  type SearchOption,
  searchOptions,
  suggestionOptions,
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
  it('flattens groups in Run, Station, Line order with stable ids', () => {
    expect(searchOptions(result).map((o) => [o.kind, o.id])).toEqual([
      ['run', 'run:2026-11-01:12345'],
      ['station', 'station:60000'],
      ['line', 'line:C1'],
    ]);
  });

  it('caps each group at 4 rows', () => {
    const many: SearchResult = {
      query: 'ma',
      runs: Array.from({ length: 6 }, (_, i) => ({
        trainNumber: `0000${i}`,
        serviceDate: '2026-11-01',
        serviceType: 'ave' as const,
      })),
      stations: Array.from({ length: 5 }, (_, i) => ({ stationCode: `6000${i}`, name: `S${i}` })),
      lines: Array.from({ length: 9 }, (_, i) => ({
        lineCode: `C${i}`,
        name: `C${i}`,
        serviceType: 'cercanias' as const,
      })),
    };
    const kinds = searchOptions(many).map((o) => o.kind);
    expect(SEARCH_GROUP_LIMIT).toBe(4);
    expect(kinds.filter((k) => k === 'run')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'station')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'line')).toHaveLength(4);
  });

  it('is empty for no hits', () => {
    expect(searchOptions({ query: 'zz', runs: [], stations: [], lines: [] })).toEqual([]);
  });
});

describe('optionHref', () => {
  const [run, station, line] = searchOptions(result) as [SearchOption, SearchOption, SearchOption];
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

describe('runRouteText', () => {
  const base = { trainNumber: '12345', serviceDate: '2026-11-01', serviceType: 'ave' } as const;
  it('shows origin → destination when both are known', () => {
    expect(runRouteText({ ...base, originName: 'Madrid', destinationName: 'Sevilla' })).toBe(
      'Madrid → Sevilla',
    );
  });
  it('falls back to the Line when either end is unknown', () => {
    expect(runRouteText({ ...base, lineCode: 'C1', originName: 'Madrid' })).toBe('C1');
    expect(runRouteText({ ...base, lineCode: 'C1' })).toBe('C1');
  });
  it('is undefined with neither route nor Line', () => {
    expect(runRouteText(base)).toBeUndefined();
  });
});

describe('suggestionOptions', () => {
  const suggestions: SearchSuggestions = {
    runs: [{ trainNumber: '03063', serviceDate: '2026-11-01', serviceType: 'ave' }],
  };

  it('lists the suggested Runs, then the four fixed main Stations', () => {
    const options = suggestionOptions(suggestions);
    expect(options.map((o) => o.id)).toEqual([
      'run:2026-11-01:03063',
      'station:60000',
      'station:17000',
      'station:71801',
      'station:51003',
    ]);
    expect(FIXED_STATIONS.map((s) => s.name)).toEqual([
      'Madrid Atocha',
      'Madrid Chamartín',
      'Barcelona Sants',
      'Sevilla-Santa Justa',
    ]);
  });

  it('still lists the Stations while the Runs are loading or failed', () => {
    expect(suggestionOptions(undefined).map((o) => o.kind)).toEqual([
      'station',
      'station',
      'station',
      'station',
    ]);
  });

  it('caps the Runs at 4', () => {
    const runs = Array.from({ length: 6 }, (_, i) => ({
      trainNumber: `0000${i}`,
      serviceDate: '2026-11-01',
      serviceType: 'ave' as const,
    }));
    expect(suggestionOptions({ runs }).filter((o) => o.kind === 'run')).toHaveLength(4);
  });
});
