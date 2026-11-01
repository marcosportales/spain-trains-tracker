import { InvalidNetworkValueError, requireNonEmpty } from './errors.js';
import { requireHubCode } from './hub.js';
import { isServiceType, type ServiceType } from './service-type.js';

/** A place where Runs stop, identified by Renfe's station code. */
export interface Station {
  readonly code: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly hubCode?: string;
  readonly serviceTypes: readonly ServiceType[];
  readonly wheelchairBoarding?: boolean;
}

export function createStation(input: Station): Station {
  const code = requireNonEmpty('Station code', input.code);
  const name = requireNonEmpty('Station name', input.name);
  assertCoordinate('latitude', input.lat, 90);
  assertCoordinate('longitude', input.lon, 180);

  if (input.serviceTypes.length === 0) {
    throw new InvalidNetworkValueError('Station must have at least one service type');
  }
  for (const type of input.serviceTypes) {
    if (!isServiceType(type)) {
      throw new InvalidNetworkValueError(`Unknown service type "${String(type)}"`);
    }
  }

  const station: Station = {
    code,
    name,
    lat: input.lat,
    lon: input.lon,
    serviceTypes: [...new Set(input.serviceTypes)],
  };
  return {
    ...station,
    ...(input.hubCode !== undefined && { hubCode: requireHubCode(input.hubCode) }),
    ...(input.wheelchairBoarding !== undefined && {
      wheelchairBoarding: input.wheelchairBoarding,
    }),
  };
}

function assertCoordinate(label: string, value: number, limit: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw new InvalidNetworkValueError(`Invalid ${label} ${value}: must be within ±${limit}`);
  }
}
