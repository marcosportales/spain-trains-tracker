/**
 * An upstream feed a Sighting or Delay comes from. `gtfsrt_*` are Official feeds; `visor_*` is the
 * optional Visor feed (ADR 0005).
 */
export const SOURCES = ['gtfsrt_cercanias', 'gtfsrt_ld', 'visor_ld', 'visor_cercanias'] as const;

export type Source = (typeof SOURCES)[number];

export function isSource(value: unknown): value is Source {
  return typeof value === 'string' && (SOURCES as readonly string[]).includes(value);
}
