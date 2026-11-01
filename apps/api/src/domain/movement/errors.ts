/** Thrown when a Run, Sighting or Delay is built from values that break its invariants. */
export class InvalidMovementValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMovementValueError';
  }
}

export function requireNonEmpty(field: string, value: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed === '') throw new InvalidMovementValueError(`${field} must not be empty`);
  return trimmed;
}
