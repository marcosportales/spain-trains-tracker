import { describe, expect, it } from 'vitest';
import { parseVehicleLabel } from './vehicle-label.js';

// One row per distinct label shape seen in test/fixtures/2026-10-31/vehicle_positions*.pb
describe('parseVehicleLabel', () => {
  it.each([
    ['C1-23578-PLATF.(4)', { lineCode: 'C1', trainNumber: '23578', platform: '4' }],
    ['C4-70327-PLATF.(12)', { lineCode: 'C4', trainNumber: '70327', platform: '12' }],
    ['C2-71138-PLATF.(2AM)', { lineCode: 'C2', trainNumber: '71138', platform: '2AM' }],
    ['C10-75266-PLATF.(1)', { lineCode: 'C10', trainNumber: '75266', platform: '1' }],
    ['C4a-27314-PLATF.(8)', { lineCode: 'C4a', trainNumber: '27314', platform: '8' }],
    ['C8a-75037-PLATF.(11)', { lineCode: 'C8a', trainNumber: '75037', platform: '11' }],
    ['C4b-27502-PLATF.(1)', { lineCode: 'C4b', trainNumber: '27502', platform: '1' }],
    ['R4-77464-PLATF.(1)', { lineCode: 'R4', trainNumber: '77464', platform: '1' }],
    ['R2N-25468-PLATF.(1)', { lineCode: 'R2N', trainNumber: '25468', platform: '1' }],
    ['R2S-25567-PLATF.(1)', { lineCode: 'R2S', trainNumber: '25567', platform: '1' }],
    ['T1-23455-PLATF.(1)', { lineCode: 'T1', trainNumber: '23455', platform: '1' }],
    ['C1-23574', { lineCode: 'C1', trainNumber: '23574' }],
    ['C10-75268', { lineCode: 'C10', trainNumber: '75268' }],
    ['R16-18135', { lineCode: 'R16', trainNumber: '18135' }],
    ['R2N-25470', { lineCode: 'R2N', trainNumber: '25470' }],
    ['15064', { trainNumber: '15064' }],
    ['03309', { trainNumber: '03309' }],
  ])('parses %j', (label, expected) => {
    expect(parseVehicleLabel(label)).toEqual(expected);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseVehicleLabel(' C1-23578-PLATF.(4) ')).toEqual({
      lineCode: 'C1',
      trainNumber: '23578',
      platform: '4',
    });
  });

  it('keeps what it can when the platform is empty or malformed', () => {
    expect(parseVehicleLabel('C1-23578-PLATF.()')).toEqual({
      lineCode: 'C1',
      trainNumber: '23578',
    });
    expect(parseVehicleLabel('C1-23578-PLATF.')).toEqual({ lineCode: 'C1', trainNumber: '23578' });
    expect(parseVehicleLabel('C1-23578-PLATF.(4')).toEqual({
      lineCode: 'C1',
      trainNumber: '23578',
      platform: '4',
    });
  });

  it.each([undefined, null, '', '   ', 'garbage', '---', 42, {}])(
    'never throws and returns an empty result for %j',
    (input) => {
      expect(parseVehicleLabel(input as never)).toEqual({});
    },
  );
});
