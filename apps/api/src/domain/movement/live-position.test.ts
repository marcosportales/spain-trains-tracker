import { describe, expect, it } from 'vitest';
import { chooseLivePosition } from './live-position.js';
import { createRunId } from './run-id.js';
import { createSighting, type Sighting, type SightingInput } from './sighting.js';

const runId = createRunId('79123', '2026-10-31');

const sighting = (overrides: Partial<SightingInput>) =>
  createSighting({
    runId,
    source: 'gtfsrt_ld',
    observedAt: new Date('2026-10-31T10:00:00Z'),
    lat: 41.4,
    lon: 2.1,
    status: 'IN_TRANSIT_TO',
    stationCode: '71801',
    ...overrides,
  });

const withoutPosition = (overrides: Partial<SightingInput>): Sighting => {
  const { lat: _lat, lon: _lon, ...rest } = sighting(overrides);
  return rest;
};

describe('chooseLivePosition', () => {
  it('returns undefined without a positioned Sighting', () => {
    expect(chooseLivePosition([])).toBeUndefined();
    expect(chooseLivePosition([withoutPosition({})])).toBeUndefined();
  });

  it('prefers a real GPS fix over a snapped position, even when older', () => {
    const gps = sighting({ source: 'gtfsrt_ld', observedAt: new Date('2026-10-31T10:00:00Z') });
    const snapped = sighting({
      source: 'gtfsrt_cercanias',
      status: 'STOPPED_AT',
      observedAt: new Date('2026-10-31T10:00:20Z'),
    });
    expect(snapped.positionIsSnapped).toBe(true);
    const chosen = chooseLivePosition([snapped, gps]);
    expect(chosen?.sighting).toBe(gps);
    expect(chosen?.sources).toEqual(['gtfsrt_cercanias', 'gtfsrt_ld']);
  });

  it('lets the newest win between two GPS fixes', () => {
    const older = sighting({ source: 'gtfsrt_ld', observedAt: new Date('2026-10-31T10:00:00Z') });
    const newer = sighting({
      source: 'gtfsrt_cercanias',
      observedAt: new Date('2026-10-31T10:00:15Z'),
    });
    expect(chooseLivePosition([older, newer])?.sighting).toBe(newer);
  });

  it('lets the newest win between two snapped positions', () => {
    const older = sighting({ source: 'gtfsrt_ld', positionIsSnapped: true });
    const newer = sighting({
      source: 'gtfsrt_cercanias',
      status: 'INCOMING_AT',
      observedAt: new Date('2026-10-31T10:00:15Z'),
    });
    expect(chooseLivePosition([newer, older])?.sighting).toBe(newer);
  });

  it('lists each Source once and ignores Sightings without a position in sources', () => {
    const a = sighting({});
    const b = sighting({ observedAt: new Date('2026-10-31T10:00:05Z') });
    const noPosition = withoutPosition({ source: 'visor_ld' });
    expect(chooseLivePosition([a, b, noPosition])?.sources).toEqual(['gtfsrt_ld']);
  });

  it('treats a non-Cercanías STOPPED_AT (visor, LD) as a real GPS fix', () => {
    const visor = sighting({ source: 'visor_ld', status: 'STOPPED_AT' });
    const snapped = sighting({
      source: 'gtfsrt_cercanias',
      status: 'INCOMING_AT',
      observedAt: new Date('2026-10-31T10:00:30Z'),
    });
    expect(visor.positionIsSnapped).toBe(false);
    expect(chooseLivePosition([snapped, visor])?.sighting).toBe(visor);
  });
});
