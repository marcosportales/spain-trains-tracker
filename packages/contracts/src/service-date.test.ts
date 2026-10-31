import { describe, expect, it } from 'vitest';
import { ServiceDate } from './service-date.js';

describe('ServiceDate', () => {
  it.each(['2026-10-31', '2024-02-29', '2026-01-01'])('accepts %s', (value) => {
    expect(ServiceDate.parse(value)).toBe(value);
  });

  it.each([
    '2026-13-01',
    '2026-02-30',
    '2025-02-29',
    '2026-1-1',
    '31-10-2026',
    '2026-10-31T00:00:00Z',
    '',
    20261031,
    null,
  ])('rejects %j', (value) => {
    expect(ServiceDate.safeParse(value).success).toBe(false);
  });
});
