import { describe, expect, it } from 'vitest';
import { filtersToSearch, matchesServiceTypes, parseFilters, toStreamFilters } from './map-filters';

describe('parseFilters', () => {
  it('returns empty filters for an empty query', () => {
    expect(parseFilters(new URLSearchParams())).toEqual({ serviceTypes: [] });
  });

  it('reads Service types, Hub and Line', () => {
    const params = new URLSearchParams('type=ave,cercanias&hub=10&line=10-C1');
    expect(parseFilters(params)).toEqual({
      serviceTypes: ['ave', 'cercanias'],
      hub: '10',
      line: '10-C1',
    });
  });

  it('drops unknown Service types and unknown Hubs, and de-duplicates', () => {
    const params = new URLSearchParams('type=ave,bogus,ave&hub=99');
    expect(parseFilters(params)).toEqual({ serviceTypes: ['ave'] });
  });
});

describe('filtersToSearch', () => {
  it('is empty when nothing is filtered', () => {
    expect(filtersToSearch({ serviceTypes: [] })).toBe('');
  });

  it('round-trips through parseFilters', () => {
    const filters = { serviceTypes: ['ave', 'media_distancia'], hub: '50', line: '50-R2' } as const;
    const search = filtersToSearch({ ...filters, serviceTypes: [...filters.serviceTypes] });
    expect(parseFilters(new URLSearchParams(search))).toEqual({
      ...filters,
      serviceTypes: [...filters.serviceTypes],
    });
  });
});

describe('toStreamFilters', () => {
  it('sends Hub and Line but never the Service type, so the Legend counts every type', () => {
    expect(toStreamFilters({ serviceTypes: ['ave'], hub: '10' })).toEqual({
      serviceType: undefined,
      hub: '10',
      line: undefined,
    });
  });
});

describe('matchesServiceTypes', () => {
  it('matches everything when none is selected', () => {
    expect(matchesServiceTypes([], 'ave')).toBe(true);
  });

  it('matches only the selected ones', () => {
    expect(matchesServiceTypes(['ave'], 'ave')).toBe(true);
    expect(matchesServiceTypes(['ave'], 'cercanias')).toBe(false);
  });
});
