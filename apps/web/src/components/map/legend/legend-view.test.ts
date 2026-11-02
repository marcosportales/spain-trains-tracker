import type { LiveRun } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import type { MapRuns } from '../live/live-runs';
import { serviceTypeCounts, toggleServiceType } from './legend-view';

const run = (trainNumber: string, serviceType?: LiveRun['serviceType']) =>
  [`2026-11-02:${trainNumber}`, { trainNumber, serviceType }] as unknown as [string, LiveRun];

describe('serviceTypeCounts', () => {
  it('counts Runs per Service type, with zero for absent types', () => {
    const runs: MapRuns = new Map([
      run('1', 'cercanias'),
      run('2', 'cercanias'),
      run('3', 'ave'),
      run('4'),
    ]);
    expect(serviceTypeCounts(runs)).toEqual({
      cercanias: 2,
      ave: 1,
      larga_distancia: 0,
      media_distancia: 0,
      ancho_metrico: 0,
    });
  });
});

describe('toggleServiceType', () => {
  it('hiding one type from "all" shows the other four', () => {
    expect(toggleServiceType({ serviceTypes: [] }, 'cercanias').serviceTypes).toEqual([
      'ave',
      'larga_distancia',
      'media_distancia',
      'ancho_metrico',
    ]);
  });

  it('showing the last hidden type goes back to "all"', () => {
    const four = toggleServiceType({ serviceTypes: [] }, 'cercanias');
    expect(toggleServiceType(four, 'cercanias').serviceTypes).toEqual([]);
  });

  it('toggles within a partial set, keeping display order', () => {
    const filters = { serviceTypes: ['ave', 'ancho_metrico'] as const };
    expect(
      toggleServiceType({ serviceTypes: [...filters.serviceTypes] }, 'cercanias').serviceTypes,
    ).toEqual(['cercanias', 'ave', 'ancho_metrico']);
    expect(
      toggleServiceType({ serviceTypes: [...filters.serviceTypes] }, 'ave').serviceTypes,
    ).toEqual(['ancho_metrico']);
  });

  it('keeps Hub and Line', () => {
    expect(toggleServiceType({ serviceTypes: [], hub: '10', line: 'C1' }, 'ave')).toMatchObject({
      hub: '10',
      line: 'C1',
    });
  });

  it('never hides every type', () => {
    expect(toggleServiceType({ serviceTypes: ['ave'] }, 'ave').serviceTypes).toEqual([]);
  });
});
