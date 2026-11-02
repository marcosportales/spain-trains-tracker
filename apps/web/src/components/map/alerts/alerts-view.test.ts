import type { ServiceAlertDto } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import { affectedLineCodes, affectsSentence, formatAlertTimestamp } from './alerts-view';

const alert = (id: string, lineCodes: string[]): ServiceAlertDto => ({
  id,
  lineCodes,
  header: `header ${id}`,
});

const alerts = [alert('a', ['C1', 'C2']), alert('b', ['C2']), alert('c', ['R4'])];

describe('affectedLineCodes', () => {
  it('lists each affected Line once, sorted', () => {
    expect(affectedLineCodes(alerts)).toEqual(['C1', 'C2', 'R4']);
  });

  it('is empty without alerts', () => {
    expect(affectedLineCodes([])).toEqual([]);
  });
});

describe('affectsSentence', () => {
  it('names one Line', () => {
    expect(affectsSentence(['C1'], 'es')).toBe('Afecta a C1');
    expect(affectsSentence(['C1'], 'en')).toBe('Affects C1');
  });

  it('joins two Lines with the locale conjunction', () => {
    expect(affectsSentence(['C1', 'C5'], 'es')).toBe('Afecta a C1 y C5');
    expect(affectsSentence(['C1', 'C5'], 'en')).toBe('Affects C1 and C5');
  });

  it('joins three Lines as a list', () => {
    expect(affectsSentence(['C1', 'C2', 'C5'], 'es')).toBe('Afecta a C1, C2 y C5');
    expect(affectsSentence(['C1', 'C2', 'C5'], 'en')).toBe('Affects C1, C2, and C5');
  });
});

describe('formatAlertTimestamp', () => {
  it('formats in Madrid time', () => {
    expect(formatAlertTimestamp('2026-07-01T10:05:00Z', 'en')).toContain('12:05');
  });
});
