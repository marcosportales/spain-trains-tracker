/** Thrown when a Station, Line or Hub is built from values that break its invariants. */
export class InvalidNetworkValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidNetworkValueError';
  }
}

export function requireNonEmpty(field: string, value: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed === '') throw new InvalidNetworkValueError(`${field} must not be empty`);
  return trimmed;
}
