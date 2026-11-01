import { InvalidMovementValueError } from './errors.js';
import { isSource, type Source } from './source.js';

export function requireSource(value: unknown): Source {
  if (!isSource(value)) throw new InvalidMovementValueError(`Unknown Source "${String(value)}"`);
  return value;
}

export function requireObservedAt(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new InvalidMovementValueError('observedAt must be a valid date');
  }
  return value;
}
