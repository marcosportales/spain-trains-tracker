import { describe, expect, it } from 'vitest';
import { liveIndicator, OFFLINE_AFTER_MS, RECONNECTING_AFTER_MS } from './live-indicator';

const openedAt = 1_000_000;

describe('liveIndicator', () => {
  it('is live under 30 s after the last event', () => {
    const lastEventAt = 5_000_000;
    expect(liveIndicator({ now: lastEventAt + 29_999, lastEventAt, openedAt }).state).toBe('live');
  });

  it('is reconnecting from 30 s to under 120 s', () => {
    const lastEventAt = 5_000_000;
    expect(
      liveIndicator({ now: lastEventAt + RECONNECTING_AFTER_MS, lastEventAt, openedAt }),
    ).toMatchObject({
      state: 'reconnecting',
    });
    expect(liveIndicator({ now: lastEventAt + 119_999, lastEventAt, openedAt }).state).toBe(
      'reconnecting',
    );
  });

  it('is offline from 120 s', () => {
    const lastEventAt = 5_000_000;
    expect(
      liveIndicator({ now: lastEventAt + OFFLINE_AFTER_MS, lastEventAt, openedAt }).state,
    ).toBe('offline');
  });

  it('rounds the age down to whole seconds', () => {
    const lastEventAt = 5_000_000;
    expect(liveIndicator({ now: lastEventAt + 7_999, lastEventAt, openedAt }).ageSeconds).toBe(7);
  });

  it('is connecting when no event arrived and the stream opened under 30 s ago', () => {
    expect(liveIndicator({ now: openedAt + 5_000, lastEventAt: undefined, openedAt })).toEqual({
      state: 'connecting',
    });
  });

  it('applies the same thresholds from openedAt when no event ever arrived', () => {
    expect(liveIndicator({ now: openedAt + 30_000, lastEventAt: undefined, openedAt }).state).toBe(
      'reconnecting',
    );
    expect(
      liveIndicator({ now: openedAt + 120_000, lastEventAt: undefined, openedAt }),
    ).toMatchObject({
      state: 'offline',
      ageSeconds: 120,
    });
  });
});
