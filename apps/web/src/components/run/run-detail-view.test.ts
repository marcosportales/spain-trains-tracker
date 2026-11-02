import type { RunDetail } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  delayBadge,
  delayMinutes,
  formatMadridTime,
  isScheduledRun,
  runDetailPath,
  showsNoPositionBadge,
  stopTimes,
} from './run-detail-view';

const detail = (over: Partial<RunDetail> = {}): RunDetail => ({
  run: {
    trainNumber: '03063',
    serviceDate: '2026-10-31',
    serviceType: 'ave',
  },
  position: {
    lat: 40,
    lon: -3,
    status: 'in_transit_to',
    sources: ['official'],
    observedAt: '2026-10-31T10:00:00+01:00',
  },
  stops: [],
  ...over,
});

describe('delayBadge', () => {
  it('is cancelled whenever the Service status is cancelled', () => {
    expect(delayBadge(detail({ serviceStatus: 'cancelled', delaySeconds: 0 }))).toBe('cancelled');
  });

  it('is on_time under one minute, including early Runs', () => {
    expect(delayBadge(detail({ delaySeconds: 0 }))).toBe('on_time');
    expect(delayBadge(detail({ delaySeconds: 59 }))).toBe('on_time');
    expect(delayBadge(detail({ delaySeconds: -120 }))).toBe('on_time');
  });

  it('is minor from one minute to just under five', () => {
    expect(delayBadge(detail({ delaySeconds: 60 }))).toBe('minor');
    expect(delayBadge(detail({ delaySeconds: 299 }))).toBe('minor');
  });

  it('is major from five minutes', () => {
    expect(delayBadge(detail({ delaySeconds: 300 }))).toBe('major');
  });

  it('is unknown without a Delay', () => {
    expect(delayBadge(detail())).toBe('unknown');
  });

  it('is unknown for a Scheduled Run with no Delay', () => {
    const { position: _position, ...scheduled } = detail();
    expect(delayBadge(scheduled)).toBe('unknown');
  });
});

describe('delayMinutes', () => {
  it('rounds to whole minutes', () => {
    expect(delayMinutes(330)).toBe(6);
    expect(delayMinutes(-120)).toBe(-2);
  });
});

describe('formatMadridTime', () => {
  it('renders HH:mm in Madrid time', () => {
    expect(formatMadridTime('2026-10-31T09:05:00Z')).toBe('10:05');
    expect(formatMadridTime('2026-12-01T09:05:00Z')).toBe('10:05');
    expect(formatMadridTime('2026-07-01T09:05:00Z')).toBe('11:05');
  });
});

describe('stopTimes', () => {
  it('prefers departure, falling back to arrival, and flags a changed estimate', () => {
    expect(
      stopTimes({
        stationCode: 'A',
        sequence: 0,
        scheduledDeparture: '2026-10-31T09:00:00Z',
        estimatedDeparture: '2026-10-31T09:06:00Z',
      }),
    ).toEqual({ scheduled: '10:00', estimated: '10:06', changed: true });
    expect(
      stopTimes({
        stationCode: 'B',
        sequence: 1,
        scheduledArrival: '2026-10-31T09:30:00Z',
        estimatedArrival: '2026-10-31T09:30:00Z',
      }),
    ).toEqual({ scheduled: '10:30', estimated: '10:30', changed: false });
  });

  it('has no estimate when none is known', () => {
    expect(stopTimes({ stationCode: 'C', sequence: 2 })).toEqual({
      scheduled: undefined,
      estimated: undefined,
      changed: false,
    });
  });
});

describe('runDetailPath', () => {
  it('builds the route of a Run', () => {
    expect(runDetailPath({ serviceDate: '2026-10-31', trainNumber: '03063' })).toBe(
      '/runs/2026-10-31/03063',
    );
  });
});

describe('Scheduled Run presentation', () => {
  const scheduled = (over: Partial<RunDetail> = {}) => detail({ position: undefined, ...over });

  it('treats a Run without position as scheduled and one with position as tracked', () => {
    expect(isScheduledRun(scheduled())).toBe(true);
    expect(isScheduledRun(detail())).toBe(false);
  });

  it('shows the no-position badge for a plain Scheduled Run only', () => {
    expect(showsNoPositionBadge(scheduled())).toBe(true);
    expect(showsNoPositionBadge(detail())).toBe(false);
    expect(showsNoPositionBadge(scheduled({ serviceStatus: 'cancelled' }))).toBe(false);
    expect(showsNoPositionBadge(scheduled({ delaySeconds: 120 }))).toBe(false);
  });
});
