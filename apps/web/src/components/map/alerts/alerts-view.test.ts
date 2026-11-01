import type { ServiceAlertDto } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import {
  affectedLineCodes,
  alertLineOptions,
  alertsForLine,
  formatAlertTimestamp,
} from './alerts-view';

const alert = (id: string, lineCodes: string[]): ServiceAlertDto => ({
  id,
  lineCodes,
  header: `header ${id}`,
});

const alerts = [alert('a', ['C1', 'C2']), alert('b', ['C2']), alert('c', ['R4'])];

describe('alertsForLine', () => {
  it('returns every alert without a Line filter', () => {
    expect(alertsForLine(alerts, undefined)).toEqual(alerts);
  });

  it('keeps only alerts affecting the Line', () => {
    expect(alertsForLine(alerts, 'C2').map((a) => a.id)).toEqual(['a', 'b']);
    expect(alertsForLine(alerts, 'X9')).toEqual([]);
  });
});

describe('affectedLineCodes', () => {
  it('lists each affected Line once, sorted', () => {
    expect(affectedLineCodes(alerts)).toEqual(['C1', 'C2', 'R4']);
  });

  it('is empty without alerts', () => {
    expect(affectedLineCodes([])).toEqual([]);
  });
});

describe('alertLineOptions', () => {
  it('offers the affected Lines', () => {
    expect(alertLineOptions(alerts, undefined)).toEqual(['C1', 'C2', 'R4']);
  });

  it('keeps the selected Line even if no alert affects it', () => {
    expect(alertLineOptions(alerts, 'X9')).toEqual(['X9', 'C1', 'C2', 'R4']);
  });
});

describe('formatAlertTimestamp', () => {
  it('formats in Madrid time', () => {
    expect(formatAlertTimestamp('2026-07-01T10:05:00Z', 'en')).toContain('12:05');
  });
});
