import { describe, expect, it } from 'vitest';
import * as contracts from './index.js';

describe('@stt/contracts public entry', () => {
  it('exports every schema', () => {
    expect(Object.keys(contracts).sort()).toEqual([
      'HubCode',
      'LiveRun',
      'RunStatus',
      'ServiceDate',
      'ServiceType',
      'Source',
      'TrainNumber',
    ]);
  });
});
