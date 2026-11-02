import type { ServiceType } from '@stt/contracts';
import { SERVICE_TYPES } from '../../../theme/tokens';
import type { MapFilters } from '../filters/map-filters';
import type { MapRuns } from '../live/live-runs';

/** Runs per Service type over the streamed Runs, so a hidden type still shows its count. */
export function serviceTypeCounts(runs: MapRuns): Record<ServiceType, number> {
  const counts = Object.fromEntries(SERVICE_TYPES.map((type) => [type, 0])) as Record<
    ServiceType,
    number
  >;
  for (const run of runs.values()) if (run.serviceType) counts[run.serviceType] += 1;
  return counts;
}

/**
 * Shows or hides `type`. `serviceTypes` keeps meaning "shown types, empty = all": hiding one
 * type from "all" yields the other four, and showing the last hidden type yields `[]`. Hiding
 * the only shown type also yields `[]`, since showing nothing is never useful.
 */
export function toggleServiceType(filters: MapFilters, type: ServiceType): MapFilters {
  const shown = new Set(filters.serviceTypes.length === 0 ? SERVICE_TYPES : filters.serviceTypes);
  if (shown.has(type)) shown.delete(type);
  else shown.add(type);
  const next = SERVICE_TYPES.filter((t) => shown.has(t));
  return {
    ...filters,
    serviceTypes: next.length === SERVICE_TYPES.length || next.length === 0 ? [] : next,
  };
}
