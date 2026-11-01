import { isServiceType, type ServiceType } from '../network/service-type.js';
import { InvalidMovementValueError, requireNonEmpty } from './errors.js';
import type { RunId } from './run-id.js';

/** Whether a Run is going ahead as timetabled or has been called off. */
export const RUN_STATUSES = ['scheduled', 'cancelled'] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export function isRunStatus(value: unknown): value is RunStatus {
  return typeof value === 'string' && (RUN_STATUSES as readonly string[]).includes(value);
}

/** One concrete journey of a Train number on a Service date. */
export interface Run {
  readonly id: RunId;
  readonly serviceType: ServiceType;
  /** Code of the Line the Run operates on, when known. */
  readonly lineCode?: string;
  readonly status?: RunStatus;
  /** Whether the Rolling stock can carry wheelchair users, when the Source says. */
  readonly wheelchairAccessible?: boolean;
}

export function createRun(input: Run): Run {
  if (!isServiceType(input.serviceType)) {
    throw new InvalidMovementValueError(`Unknown service type "${String(input.serviceType)}"`);
  }
  if (input.status !== undefined && !isRunStatus(input.status)) {
    throw new InvalidMovementValueError(`Unknown Run status "${String(input.status)}"`);
  }
  return {
    id: input.id,
    serviceType: input.serviceType,
    ...(input.lineCode !== undefined && { lineCode: requireNonEmpty('Line code', input.lineCode) }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.wheelchairAccessible !== undefined && {
      wheelchairAccessible: input.wheelchairAccessible,
    }),
  };
}
