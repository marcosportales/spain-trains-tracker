import type { SightingWindow } from '@stt/contracts';
import { normalizeTrainNumber } from '../../domain/movement/index.js';
import type { SightingWindowReader } from './sighting-window.reader.js';

export const DEFAULT_STEP_SECONDS = 60;
/** Longest window one call may replay. */
export const MAX_WINDOW_MS = 6 * 60 * 60 * 1000;

/** The request is not a valid window: empty, reversed or too long. */
export class InvalidSightingWindowError extends Error {}

export interface SightingWindowRequest {
  readonly from: Date;
  readonly to: Date;
  readonly stepSeconds?: number;
  readonly trainNumber?: string;
}

/** Downsampled Sightings of a time window, to replay a past Service date on the map. */
export class GetSightingWindow {
  constructor(private readonly reader: SightingWindowReader) {}

  async execute(request: SightingWindowRequest): Promise<SightingWindow> {
    const { from, to } = request;
    if (to.getTime() <= from.getTime())
      throw new InvalidSightingWindowError('`to` must be after `from`');
    if (to.getTime() - from.getTime() > MAX_WINDOW_MS)
      throw new InvalidSightingWindowError('the window must not exceed 6 hours');
    const stepSeconds = request.stepSeconds ?? DEFAULT_STEP_SECONDS;
    const trainNumber =
      request.trainNumber !== undefined ? normalizeTrainNumber(request.trainNumber) : undefined;

    const sightings = await this.reader.sightings({
      from,
      to,
      stepSeconds,
      ...(trainNumber !== undefined ? { trainNumber } : {}),
    });
    return { from: from.toISOString(), to: to.toISOString(), stepSeconds, sightings };
  }
}
