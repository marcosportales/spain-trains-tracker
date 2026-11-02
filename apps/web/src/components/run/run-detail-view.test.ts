import type { RunDetail } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  delayBand,
  formatMadridTime,
  isScheduledRun,
  runDetailPath,
  runHeadline,
  stopTimeline,
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

const POSITION = detail().position as NonNullable<RunDetail['position']>;

describe('delayBand', () => {
  it('is cancelled whenever the Service status is cancelled', () => {
    expect(delayBand(detail({ serviceStatus: 'cancelled', delaySeconds: 0 }))).toBe('cancelled');
  });

  it('is on_time under five minutes, including early Runs', () => {
    expect(delayBand(detail({ delaySeconds: 0 }))).toBe('on_time');
    expect(delayBand(detail({ delaySeconds: 299 }))).toBe('on_time');
    expect(delayBand(detail({ delaySeconds: -120 }))).toBe('on_time');
  });

  it('is late from five minutes to just under fifteen', () => {
    expect(delayBand(detail({ delaySeconds: 300 }))).toBe('late');
    expect(delayBand(detail({ delaySeconds: 899 }))).toBe('late');
  });

  it('is severely_late from fifteen minutes', () => {
    expect(delayBand(detail({ delaySeconds: 900 }))).toBe('severely_late');
  });

  it('is unknown without a Delay', () => {
    expect(delayBand(detail())).toBe('unknown');
  });

  it('is unknown for a Scheduled Run with no Delay', () => {
    const { position: _position, ...scheduled } = detail();
    expect(delayBand(scheduled)).toBe('unknown');
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
});

describe('runHeadline', () => {
  const names = (code: string) => (code === 'A' ? 'Atocha' : code === 'C' ? 'Chamartín' : code);
  const stops = [
    { stationCode: 'C', sequence: 0, scheduledDeparture: '2026-10-31T10:05:00+01:00' },
    {
      stationCode: 'A',
      sequence: 1,
      scheduledArrival: '2026-10-31T10:35:00+01:00',
      estimatedArrival: '2026-10-31T10:42:00+01:00',
    },
  ];
  const withNext = (over: Partial<RunDetail> = {}) =>
    detail({
      stops,
      position: { ...POSITION, nextStationCode: 'A' },
      ...over,
    });

  it('is cancelled even when the Run has a Delay', () => {
    expect(runHeadline(withNext({ serviceStatus: 'cancelled', delaySeconds: 600 }), names)).toEqual(
      { kind: 'cancelled' },
    );
  });

  it('says where a Scheduled Run leaves from, and when', () => {
    const { position: _position, ...scheduled } = withNext();
    expect(runHeadline(scheduled, names)).toEqual({
      kind: 'not_departed',
      origin: 'Chamartín',
      time: '10:05',
    });
  });

  it('orders the origin by sequence, not array order', () => {
    const { position: _position, ...scheduled } = withNext({ stops: [...stops].reverse() });
    expect(runHeadline(scheduled, names)).toMatchObject({ origin: 'Chamartín' });
  });

  it('is running/late with minutes and the next stop at its estimated arrival', () => {
    expect(runHeadline(withNext({ delaySeconds: 420 }), names)).toEqual({
      kind: 'running',
      band: 'late',
      minutes: 7,
      nextStop: { station: 'Atocha', time: '10:42' },
    });
  });

  it('is on_time for a negative Delay, without minutes', () => {
    expect(runHeadline(withNext({ delaySeconds: -60 }), names)).toEqual({
      kind: 'running',
      band: 'on_time',
      nextStop: { station: 'Atocha', time: '10:42' },
    });
  });

  it('is unknown without a Delay', () => {
    expect(runHeadline(withNext(), names)).toMatchObject({ kind: 'running', band: 'unknown' });
  });

  it('leaves out the time when the next stop is not in the stops', () => {
    expect(runHeadline(withNext({ stops: stops.slice(0, 1) }), names)).toEqual({
      kind: 'running',
      band: 'unknown',
      nextStop: { station: 'Atocha' },
    });
  });

  it('has no next stop when the position names none', () => {
    expect(runHeadline(detail({ stops }), names)).toEqual({ kind: 'running', band: 'unknown' });
  });
});

describe('stopTimeline', () => {
  const names = (code: string) => `name-${code}`;
  const stops = ['A', 'B', 'C'].map((stationCode, sequence) => ({
    stationCode,
    sequence,
    scheduledDeparture: `2026-10-31T1${sequence}:00:00+01:00`,
  }));
  const tracked = (status: 'stopped_at' | 'incoming_at' | 'in_transit_to', next?: string) =>
    detail({
      stops: [...stops].reverse(),
      position: {
        ...POSITION,
        status,
        ...(next !== undefined && { nextStationCode: next }),
      },
    });
  const states = (d: RunDetail) => stopTimeline(d, names).stops.map((s) => s.state);

  it('makes every stop future, with no marker, for a Scheduled Run', () => {
    const { position: _position, ...scheduled } = detail({ stops });
    expect(states(scheduled)).toEqual(['future', 'future', 'future']);
    expect(stopTimeline(scheduled, names).marker).toBeUndefined();
  });

  it('lists stops by sequence with names and times', () => {
    const { stops: rows } = stopTimeline(tracked('in_transit_to', 'B'), names);
    expect(rows.map((r) => r.station)).toEqual(['name-A', 'name-B', 'name-C']);
    expect(rows[0]?.times.scheduled).toBe('10:00');
  });

  it('puts the marker on the next stop when the train is stopped there', () => {
    const d = tracked('stopped_at', 'B');
    expect(states(d)).toEqual(['past', 'current', 'future']);
    expect(stopTimeline(d, names).marker).toEqual({ atIndex: 1, between: false });
  });

  it('puts the marker between the previous and next stop when moving', () => {
    for (const status of ['incoming_at', 'in_transit_to'] as const) {
      const d = tracked(status, 'C');
      expect(states(d)).toEqual(['past', 'past', 'future']);
      expect(stopTimeline(d, names).marker).toEqual({ atIndex: 2, between: true });
    }
  });

  it('makes every stop future, with no marker, when the next station is not a stop', () => {
    for (const d of [tracked('in_transit_to', 'Z'), tracked('in_transit_to')]) {
      expect(states(d)).toEqual(['future', 'future', 'future']);
      expect(stopTimeline(d, names).marker).toBeUndefined();
    }
  });
});
