import type { Source as ContractSource, RunDetail, RunStop } from '@stt/contracts';
import {
  chooseLivePosition,
  createRunId,
  madridLocalToDate,
  type RunStopEstimate,
  type Source,
} from '../../domain/movement/index.js';
import type { ScheduledStop } from '../../domain/network/index.js';
import type { LiveRunStatus } from '../live/live-updates.publisher.js';
import type { NetworkRepository } from '../network/network.repository.js';
import type { RunDetailReader } from './run-detail.reader.js';

/** No Run with that Train number and Service date is known, or none has ever been seen on the map. */
export class RunNotFoundError extends Error {
  constructor(
    readonly trainNumber: string,
    readonly serviceDate: string,
  ) {
    super(`Unknown Run ${trainNumber} on ${serviceDate}`);
    this.name = 'RunNotFoundError';
  }
}

const STATUS_OF = {
  STOPPED_AT: 'stopped_at',
  INCOMING_AT: 'incoming_at',
  IN_TRANSIT_TO: 'in_transit_to',
} as const satisfies Record<string, LiveRunStatus>;

const toContractSource = (source: Source): ContractSource =>
  source.startsWith('visor') ? 'visor' : 'official';

/**
 * One Run in full: its latest Sighting, ordered stops and Rolling stock. Estimated stop times come
 * from the Visor feed when it reported them, otherwise from the timetable plus the current Delay.
 */
export class GetRunDetail {
  constructor(
    private readonly reader: RunDetailReader,
    private readonly network: NetworkRepository,
  ) {}

  /** `trainNumber` may omit leading zeros (`3063` finds Run `03063`). */
  async execute(rawTrainNumber: string, serviceDate: string): Promise<RunDetail> {
    const { trainNumber } = createRunId(rawTrainNumber, serviceDate);
    const stored = await this.reader.findRunDetail(trainNumber, serviceDate);
    const position = stored && chooseLivePosition(stored.sightings);
    const sighting = position?.sighting;
    if (!stored || !position || sighting?.lat === undefined || sighting.lon === undefined) {
      throw new RunNotFoundError(trainNumber, serviceDate);
    }
    const { run, delay } = stored;
    const stops =
      stored.stopEstimates.length > 0
        ? stored.stopEstimates.map(fromEstimate)
        : await this.timetableStops(trainNumber, serviceDate, run.lineCode, delay?.seconds);
    const first = stops[0];
    const last = stops.at(-1);

    return {
      run: {
        trainNumber: run.id.trainNumber,
        serviceDate: run.id.serviceDate,
        serviceType: run.serviceType,
        ...(run.lineCode !== undefined && { lineCode: run.lineCode }),
        lat: sighting.lat,
        lon: sighting.lon,
        status: STATUS_OF[sighting.status],
        ...(delay !== undefined && { delaySeconds: delay.seconds }),
        ...(sighting.stationCode !== undefined && { nextStationCode: sighting.stationCode }),
        sources: [...new Set(position.sources.map(toContractSource))],
        observedAt: sighting.observedAt.toISOString(),
      },
      ...(first && { originStationCode: first.stationCode }),
      ...(last && { destinationStationCode: last.stationCode }),
      ...(run.status !== undefined && { serviceStatus: run.status }),
      ...(run.wheelchairAccessible !== undefined && {
        wheelchairAccessible: run.wheelchairAccessible,
      }),
      stops,
      ...(delay !== undefined && { delaySeconds: delay.seconds }),
      ...(run.rollingStock !== undefined && { rollingStock: run.rollingStock }),
    };
  }

  private async timetableStops(
    trainNumber: string,
    serviceDate: string,
    lineCode: string | undefined,
    delaySeconds: number | undefined,
  ): Promise<RunStop[]> {
    const scheduled = await this.network.findScheduledRuns(trainNumber, serviceDate);
    const trip = scheduled.find((s) => s.lineCode === lineCode) ?? scheduled[0];
    if (!trip) return [];
    const stops = await this.network.getScheduledStops(trip.tripId);
    return stops.map((stop) => fromTimetable(stop, serviceDate, delaySeconds));
  }
}

const iso = (date: Date) => date.toISOString();

function fromEstimate(e: RunStopEstimate): RunStop {
  return {
    stationCode: e.stationCode,
    sequence: e.sequence,
    scheduledArrival: iso(e.scheduledArrival),
    scheduledDeparture: iso(e.scheduledDeparture),
    estimatedArrival: iso(e.estimatedArrival),
    estimatedDeparture: iso(e.estimatedDeparture),
  };
}

/** Timetable seconds count from midnight of the Service date, Madrid time, and may pass 24h. */
function fromTimetable(
  stop: ScheduledStop,
  serviceDate: string,
  delaySeconds: number | undefined,
): RunStop {
  const at = (seconds: number) => madridLocalToDate(serviceDate, 0, 0, seconds);
  const arrival = at(stop.arrivalSeconds);
  const departure = at(stop.departureSeconds);
  const delayed = (date: Date) => new Date(date.getTime() + (delaySeconds ?? 0) * 1000);
  return {
    stationCode: stop.stationCode,
    sequence: stop.sequence,
    scheduledArrival: iso(arrival),
    scheduledDeparture: iso(departure),
    ...(delaySeconds !== undefined && {
      estimatedArrival: iso(delayed(arrival)),
      estimatedDeparture: iso(delayed(departure)),
    }),
  };
}
