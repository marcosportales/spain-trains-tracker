import { describe, expect, it } from 'vitest';
import * as contracts from './index.js';

describe('@stt/contracts public entry', () => {
  it('exports every schema', () => {
    expect(Object.keys(contracts).sort()).toEqual([
      'CycleId',
      'FeedHealthDto',
      'HealthDto',
      'HubCode',
      'LineCode',
      'LineDto',
      'LineSearchHit',
      'LiveDiff',
      'LiveRun',
      'LiveSnapshot',
      'RunDetail',
      'RunId',
      'RunSearchHit',
      'RunStatus',
      'RunStop',
      'SearchResult',
      'ServiceAlertDto',
      'ServiceDate',
      'ServiceStatus',
      'ServiceType',
      'Source',
      'StationBoard',
      'StationBoardEntry',
      'StationCode',
      'StationList',
      'StationSearchHit',
      'StationSummary',
      'Timestamp',
      'TrackFeature',
      'TrackFeatureCollection',
      'TrainNumber',
    ]);
  });
});
