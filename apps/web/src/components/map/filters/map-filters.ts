import type { LiveRun, ServiceType } from '@stt/contracts';
import { SERVICE_TYPES } from '../../../theme/tokens';
import type { LiveRunFilters } from '../live/use-live-runs';

/** What the map is narrowed to. Lives in the URL so a view can be shared and survives reload. */
export type MapFilters = {
  /** Empty means every Service type. */
  serviceTypes: ServiceType[];
  hub?: string | undefined;
  line?: string | undefined;
};

/**
 * Hubs the filter offers (Renfe núcleo codes). Stopgap until `GET /lines` (#37) exposes them;
 * mirrors `HUBS` in the API's network domain. Rodalies is `50` in the live feeds.
 */
export const HUB_OPTIONS = [
  { code: '10', name: 'Madrid' },
  { code: '20', name: 'Asturias' },
  { code: '30', name: 'Sevilla' },
  { code: '31', name: 'Cádiz' },
  { code: '32', name: 'Málaga' },
  { code: '40', name: 'Valencia' },
  { code: '41', name: 'Murcia/Alicante' },
  { code: '50', name: 'Rodalies de Catalunya' },
  { code: '60', name: 'Bilbao' },
  { code: '61', name: 'San Sebastián' },
  { code: '62', name: 'Santander' },
] as const;

const isServiceType = (value: string): value is ServiceType =>
  (SERVICE_TYPES as string[]).includes(value);

const HUB_CODES: ReadonlySet<string> = new Set(HUB_OPTIONS.map((h) => h.code));

export function parseFilters(params: URLSearchParams): MapFilters {
  const serviceTypes: ServiceType[] = [];
  for (const raw of (params.get('type') ?? '').split(',')) {
    if (isServiceType(raw) && !serviceTypes.includes(raw)) serviceTypes.push(raw);
  }
  const hub = params.get('hub');
  const line = params.get('line');
  return {
    serviceTypes,
    ...(hub && HUB_CODES.has(hub) && { hub }),
    ...(line && { line }),
  };
}

/** Query string (without `?`) for `filters`; empty when nothing is filtered. */
export function filtersToSearch(filters: MapFilters): string {
  const params = new URLSearchParams();
  if (filters.serviceTypes.length > 0) params.set('type', filters.serviceTypes.join(','));
  if (filters.hub) params.set('hub', filters.hub);
  if (filters.line) params.set('line', filters.line);
  return params.toString();
}

/**
 * Filters sent to `/live/stream`. The Service type is never sent: the Legend counts every type
 * even while some are hidden, so `matchesServiceTypes` narrows the Runs client-side.
 */
export function toStreamFilters(filters: MapFilters): LiveRunFilters {
  return { serviceType: undefined, hub: filters.hub, line: filters.line };
}

export function matchesServiceTypes(
  selected: readonly ServiceType[],
  type: LiveRun['serviceType'],
) {
  return selected.length === 0 || selected.includes(type);
}
