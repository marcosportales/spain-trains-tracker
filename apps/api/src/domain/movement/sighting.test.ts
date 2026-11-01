import { describe, expect, it } from 'vitest';
import { InvalidMovementValueError } from './errors.js';
import { createRunId } from './run-id.js';
import { createSighting, type SightingInput } from './sighting.js';

const runId = createRunId('3063', '2026-10-31');
const base: SightingInput = {
  runId,
  source: 'gtfsrt_cercanias',
  observedAt: new Date('2026-10-31T10:00:00Z'),
  lat: 40.4065,
  lon: -3.6892,
  status: 'IN_TRANSIT_TO',
};

describe('createSighting', () => {
  it('marks a Cercanías GTFS-RT Sighting that is STOPPED_AT or INCOMING_AT as snapped', () => {
    for (const status of ['STOPPED_AT', 'INCOMING_AT'] as const) {
      expect(createSighting({ ...base, status, stationCode: '17000' }).positionIsSnapped).toBe(
        true,
      );
    }
  });

  it('keeps a Cercanías IN_TRANSIT_TO Sighting as real GPS', () => {
    expect(createSighting(base).positionIsSnapped).toBe(false);
  });

  it('does not let the caller un-snap a Cercanías Sighting at a Station', () => {
    const sighting = createSighting({ ...base, status: 'STOPPED_AT', positionIsSnapped: false });
    expect(sighting.positionIsSnapped).toBe(true);
  });

  it('trusts other Sources unless the caller says the position is snapped', () => {
    const ld = { ...base, source: 'gtfsrt_ld', status: 'STOPPED_AT' } as const;
    expect(createSighting(ld).positionIsSnapped).toBe(false);
    expect(createSighting({ ...ld, positionIsSnapped: true }).positionIsSnapped).toBe(true);
  });

  it('allows a Sighting without a position', () => {
    const sighting = createSighting({
      runId,
      source: 'visor_ld',
      observedAt: base.observedAt,
      status: 'STOPPED_AT',
      stationCode: ' 17000 ',
      platform: ' 3 ',
    });
    expect(sighting).toMatchObject({
      stationCode: '17000',
      platform: '3',
      positionIsSnapped: false,
    });
    expect(sighting).not.toHaveProperty('lat');
    expect(sighting).not.toHaveProperty('lon');
  });

  it('rejects an unknown Source or status', () => {
    expect(() => createSighting({ ...base, source: 'tiktok' as never })).toThrow(
      InvalidMovementValueError,
    );
    expect(() => createSighting({ ...base, status: 'FLYING' as never })).toThrow(
      InvalidMovementValueError,
    );
  });

  it('rejects a position with only one coordinate or out of range', () => {
    const { lon: _lon, ...onlyLat } = base;
    expect(() => createSighting(onlyLat)).toThrow(InvalidMovementValueError);
    expect(() => createSighting({ ...base, lat: 91 })).toThrow(InvalidMovementValueError);
    expect(() => createSighting({ ...base, lon: Number.NaN })).toThrow(InvalidMovementValueError);
  });

  it('rejects an invalid observation time and blank Station or platform', () => {
    expect(() => createSighting({ ...base, observedAt: new Date('nope') })).toThrow(
      InvalidMovementValueError,
    );
    expect(() => createSighting({ ...base, stationCode: '  ' })).toThrow(InvalidMovementValueError);
    expect(() => createSighting({ ...base, platform: '' })).toThrow(InvalidMovementValueError);
  });
});
