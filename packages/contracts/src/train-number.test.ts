import { describe, expect, it } from 'vitest';
import { TrainNumber } from './train-number.js';

describe('TrainNumber', () => {
  it.each(['03063', '23579', '9', '123456'])('accepts %s', (value) => {
    expect(TrainNumber.parse(value)).toBe(value);
  });

  it('keeps leading zeros (it is a string, not a number)', () => {
    expect(TrainNumber.parse('03063')).toBe('03063');
  });

  it.each(['', '1234567', 'C1-23579', ' 03063', '03063 ', '-1', '1.5', 3063, null])(
    'rejects %j',
    (value) => {
      expect(TrainNumber.safeParse(value).success).toBe(false);
    },
  );
});
