import { describe, expect, it } from 'vitest';
import * as contracts from './index.js';

describe('@stt/contracts public entry', () => {
  it('exports every schema', () => {
    expect(Object.keys(contracts).sort()).toEqual([
      'CycleId',
      'DelayByHour',
      'FeedHealthDto',
      'HealthDto',
      'HourPunctuality',
      'HubCode',
      'LineCode',
      'LineDto',
      'LinePunctuality',
      'LineSearchHit',
      'LiveDiff',
      'LiveRun',
      'LiveSnapshot',
      'PunctualityRanking',
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
