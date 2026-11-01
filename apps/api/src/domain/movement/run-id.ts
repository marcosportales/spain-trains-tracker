import { InvalidMovementValueError } from './errors.js';

/**
 * Identifies a Run across Sources: Train number + Service date (ADR 0004). Never a feed's trip id.
 * Build it with `createRunId` so the Train number is normalized.
 */
export interface RunId {
  /** Always 5 digits, zero-padded (`03063`). */
  readonly trainNumber: string;
  /** `YYYY-MM-DD`, a real calendar date. */
  readonly serviceDate: string;
}

const DIGITS_PATTERN = /^\d+$/;
const SERVICE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Trims, zero-pads to 5 digits and checks a Train number (`' 3063'` → `'03063'`). */
export function normalizeTrainNumber(value: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const digits = trimmed.replace(/^0+/, '');
  if (!DIGITS_PATTERN.test(trimmed) || digits === '' || digits.length > 5) {
    throw new InvalidMovementValueError(`Train number must be 1 to 5 digits, got "${value}"`);
  }
  return digits.padStart(5, '0');
}

/** Trims and checks a Service date: `YYYY-MM-DD` and a real calendar date. */
export function requireServiceDate(value: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const match = SERVICE_DATE_PATTERN.exec(trimmed);
  if (match) {
    const [, year, month, day] = match.map(Number) as [number, number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return trimmed;
    }
  }
  throw new InvalidMovementValueError(
    `Service date must be a real YYYY-MM-DD date, got "${value}"`,
  );
}

export function createRunId(trainNumber: string, serviceDate: string): RunId {
  return {
    trainNumber: normalizeTrainNumber(trainNumber),
    serviceDate: requireServiceDate(serviceDate),
  };
}

export function runIdEquals(a: RunId, b: RunId): boolean {
  return a.trainNumber === b.trainNumber && a.serviceDate === b.serviceDate;
}

/** A stable string for maps and logs: `03063@2026-10-31`. */
export function runIdKey(id: RunId): string {
  return `${id.trainNumber}@${id.serviceDate}`;
}
