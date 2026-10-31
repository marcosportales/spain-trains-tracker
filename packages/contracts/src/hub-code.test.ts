import { describe, expect, it } from 'vitest';
import { HubCode } from './hub-code.js';

describe('HubCode', () => {
  it.each(['madrid', 'rodalies-de-catalunya', 'valencia', 'asturias'])('accepts %s', (value) => {
    expect(HubCode.parse(value)).toBe(value);
  });

  it.each(['', 'Madrid', 'rodalies de catalunya', '-madrid', 'madrid-', 7, null])(
    'rejects %j',
    (value) => {
      expect(HubCode.safeParse(value).success).toBe(false);
    },
  );
});
