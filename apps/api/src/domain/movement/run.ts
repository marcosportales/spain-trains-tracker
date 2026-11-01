import { isServiceType, type ServiceType } from '../network/service-type.js';
import { InvalidMovementValueError, requireNonEmpty } from './errors.js';
import type { RunId } from './run-id.js';

/** One concrete journey of a Train number on a Service date. */
export interface Run {
  readonly id: RunId;
  readonly serviceType: ServiceType;
  /** Code of the Line the Run operates on, when known. */
  readonly lineCode?: string;
}

export function createRun(input: Run): Run {
  if (!isServiceType(input.serviceType)) {
    throw new InvalidMovementValueError(`Unknown service type "${String(input.serviceType)}"`);
  }
  return {
    id: input.id,
    serviceType: input.serviceType,
    ...(input.lineCode !== undefined && { lineCode: requireNonEmpty('Line code', input.lineCode) }),
  };
}
