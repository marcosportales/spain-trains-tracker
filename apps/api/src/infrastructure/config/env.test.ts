import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies defaults when nothing is set', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3001,
      LOG_LEVEL: 'info',
      DATABASE_URL: 'postgresql://stt:stt@localhost:5432/stt',
      WORKER_HEARTBEAT_INTERVAL_MS: 20_000,
      FEED_POLL_INTERVAL_MS: 20_000,
    });
  });

  it('coerces numeric values from strings', () => {
    const env = parseEnv({ PORT: '4000', WORKER_HEARTBEAT_INTERVAL_MS: '500' });
    expect(env.PORT).toBe(4000);
    expect(env.WORKER_HEARTBEAT_INTERVAL_MS).toBe(500);
  });

  it('rejects invalid values with a readable message', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => parseEnv({ LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });
});
