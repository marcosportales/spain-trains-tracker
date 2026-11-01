import { InvalidNetworkValueError, requireNonEmpty } from './errors.js';

/** A Hub: a city-level Cercanías network. `code` is Renfe's two-digit núcleo code. */
export interface Hub {
  readonly code: string;
  readonly name: string;
}

/**
 * Renfe núcleo code → Hub name. Covers every code seen in the recorded fixtures
 * (10, 20, 30, 31, 32, 40, 41, 50, 60, 61, 62). Rodalies appears as `50` in the live
 * feeds; `51` is also kept as it is documented for the same network.
 */
export const HUBS: readonly Hub[] = [
  { code: '10', name: 'Madrid' },
  { code: '20', name: 'Asturias' },
  { code: '30', name: 'Sevilla' },
  { code: '31', name: 'Cádiz' },
  { code: '32', name: 'Málaga' },
  { code: '40', name: 'Valencia' },
  { code: '41', name: 'Murcia/Alicante' },
  { code: '50', name: 'Rodalies de Catalunya' },
  { code: '51', name: 'Rodalies de Catalunya' },
  { code: '60', name: 'Bilbao' },
  { code: '61', name: 'San Sebastián' },
  { code: '62', name: 'Santander' },
];

const NAMES = new Map(HUBS.map((hub) => [hub.code, hub.name]));

const HUB_CODE_PATTERN = /^\d{2}$/;

export function isHubCode(value: string): boolean {
  return HUB_CODE_PATTERN.test(value);
}

/** Trims and checks a Hub code, throwing `InvalidNetworkValueError` when it is not two digits. */
export function requireHubCode(value: string): string {
  const code = requireNonEmpty('Hub code', value);
  if (!isHubCode(code)) {
    throw new InvalidNetworkValueError(`Hub code must be two digits, got "${code}"`);
  }
  return code;
}

export function hubNameFor(code: string): string | undefined {
  return NAMES.get(code);
}

/** Builds a Hub, taking the name from the table when none is given. */
export function createHub(code: string, name?: string): Hub {
  const trimmedCode = requireHubCode(code);
  const resolved = name ?? hubNameFor(trimmedCode);
  if (resolved === undefined) {
    throw new InvalidNetworkValueError(`Unknown Hub code "${trimmedCode}" and no name given`);
  }
  return { code: trimmedCode, name: requireNonEmpty('Hub name', resolved) };
}

/** A Cercanías id starts with its Hub code (the first two digits). */
export function hubCodeFromCercaniasId(id: string): string | undefined {
  const prefix = id.slice(0, 2);
  return isHubCode(prefix) ? prefix : undefined;
}
