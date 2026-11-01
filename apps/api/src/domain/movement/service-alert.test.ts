import { describe, expect, it } from 'vitest';
import { InvalidMovementValueError } from './errors.js';
import { createServiceAlert, reconcileServiceAlerts, type ServiceAlert } from './service-alert.js';

const NOW = new Date('2026-10-31T12:00:00Z');
const alert = (id: string, extra: Partial<ServiceAlert> = {}): ServiceAlert =>
  createServiceAlert({
    id,
    header: 'h',
    description: 'd',
    activePeriods: [],
    lineCodes: [],
    stationCodes: [],
    source: 'gtfsrt_cercanias',
    ...extra,
  });

describe('createServiceAlert', () => {
  it('rejects an empty id, header or description', () => {
    expect(() => alert(' ')).toThrow(InvalidMovementValueError);
    expect(() => alert('a', { header: '' })).toThrow(InvalidMovementValueError);
    expect(() => alert('a', { description: '' })).toThrow(InvalidMovementValueError);
  });

  it('rejects a period that ends before it starts', () => {
    expect(() =>
      alert('a', { activePeriods: [{ start: NOW, end: new Date('2026-10-31T11:00:00Z') }] }),
    ).toThrow(InvalidMovementValueError);
  });

  it('deduplicates line and station codes', () => {
    const created = alert('a', { lineCodes: ['10-C4', '10-C4'], stationCodes: ['1', '1'] });
    expect(created.lineCodes).toEqual(['10-C4']);
    expect(created.stationCodes).toEqual(['1']);
  });
});

describe('reconcileServiceAlerts', () => {
  const byId = (alerts: ServiceAlert[], id: string) => alerts.find((a) => a.id === id);

  it('sets endedAt on a stored alert that disappeared from the feed', () => {
    const result = reconcileServiceAlerts(
      [alert('a'), alert('b')],
      [alert('b')],
      'gtfsrt_cercanias',
      NOW,
    );
    expect(byId(result, 'a')?.endedAt).toEqual(NOW);
    expect(byId(result, 'b')?.endedAt).toBeUndefined();
  });

  it('keeps the original endedAt of an alert that already ended', () => {
    const earlier = new Date('2026-10-30T00:00:00Z');
    const result = reconcileServiceAlerts(
      [alert('a', { endedAt: earlier })],
      [],
      'gtfsrt_cercanias',
      NOW,
    );
    expect(byId(result, 'a')?.endedAt).toEqual(earlier);
  });

  it('upserts: the feed version replaces the stored one and clears endedAt', () => {
    const stored = alert('a', { header: 'old', endedAt: NOW });
    const result = reconcileServiceAlerts(
      [stored],
      [alert('a', { header: 'new' })],
      'gtfsrt_cercanias',
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ header: 'new' });
    expect(result[0]?.endedAt).toBeUndefined();
  });

  it('adds alerts that are new in the feed', () => {
    expect(reconcileServiceAlerts([], [alert('a')], 'gtfsrt_cercanias', NOW)).toHaveLength(1);
  });

  it('does not end alerts of another Source', () => {
    const other = alert('x', { source: 'gtfsrt_ld' });
    const result = reconcileServiceAlerts([other], [], 'gtfsrt_cercanias', NOW);
    expect(byId(result, 'x')?.endedAt).toBeUndefined();
  });
});
