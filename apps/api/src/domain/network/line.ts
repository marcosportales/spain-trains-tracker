import { InvalidNetworkValueError, requireNonEmpty } from './errors.js';
import { requireHubCode } from './hub.js';
import { isServiceType, type ServiceType } from './service-type.js';

/** A named commercial route that Runs operate on (C1, R2, AVE Madrid–Sevilla). */
export interface Line {
  readonly code: string;
  readonly name: string;
  readonly serviceType: ServiceType;
  readonly hubCode?: string;
  /** Six hex digits without `#`, as in GTFS `route_color`. */
  readonly color?: string;
}

const COLOR_PATTERN = /^[0-9A-Fa-f]{6}$/;

export function createLine(input: Line): Line {
  const code = requireNonEmpty('Line code', input.code);
  const name = requireNonEmpty('Line name', input.name);
  if (!isServiceType(input.serviceType)) {
    throw new InvalidNetworkValueError(`Unknown service type "${String(input.serviceType)}"`);
  }
  if (input.color !== undefined && !COLOR_PATTERN.test(input.color)) {
    throw new InvalidNetworkValueError(`Line color must be six hex digits, got "${input.color}"`);
  }
  return {
    code,
    name,
    serviceType: input.serviceType,
    ...(input.hubCode !== undefined && { hubCode: requireHubCode(input.hubCode) }),
    ...(input.color !== undefined && { color: input.color }),
  };
}
