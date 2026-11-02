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

/** No Run with that Train number and Service date is in the timetable or the live data. */
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

  /**
   * `trainNumber` may omit leading zeros (`3063` finds Run `03063`). A Run in the timetable but
   * without a positioned Sighting is a Scheduled Run: it has stops and no `position`.
   */
  async execute(rawTrainNumber: string, serviceDate: string): Promise<RunDetail> {
    const { trainNumber } = createRunId(rawTrainNumber, serviceDate);
    const stored = await this.reader.findRunDetail(trainNumber, serviceDate);
    const scheduled = await this.network.findScheduledRuns(trainNumber, serviceDate);
    const lineCode = stored?.run.lineCode;
    const trip = scheduled.find((s) => s.lineCode === lineCode) ?? scheduled[0];
    const identity = stored?.run ?? trip;
    if (!identity) throw new RunNotFoundError(trainNumber, serviceDate);

    const delay = stored?.delay;
    const stops =
      stored && stored.stopEstimates.length > 0
        ? stored.stopEstimates.map(fromEstimate)
        : trip
          ? (await this.network.getScheduledStops(trip.tripId)).map((stop) =>
              fromTimetable(stop, serviceDate, delay?.seconds),
            )
          : [];
    const first = stops[0];
    const last = stops.at(-1);
    const run = stored?.run;
    const live = stored && chooseLivePosition(stored.sightings);
    const sighting = live?.sighting;

    return {
      run: {
        trainNumber,
        serviceDate,
        serviceType: identity.serviceType,
        ...(identity.lineCode !== undefined && { lineCode: identity.lineCode }),
      },
      ...(live &&
        sighting?.lat !== undefined &&
        sighting.lon !== undefined && {
          position: {
            lat: sighting.lat,
            lon: sighting.lon,
            status: STATUS_OF[sighting.status],
            ...(sighting.stationCode !== undefined && { nextStationCode: sighting.stationCode }),
            sources: [...new Set(live.sources.map(toContractSource))],
            observedAt: sighting.observedAt.toISOString(),
          },
        }),
      ...(first && { originStationCode: first.stationCode }),
      ...(last && { destinationStationCode: last.stationCode }),
      ...(run?.status !== undefined && { serviceStatus: run.status }),
      ...(run?.wheelchairAccessible !== undefined && {
        wheelchairAccessible: run.wheelchairAccessible,
      }),
      stops,
      ...(delay !== undefined && { delaySeconds: delay.seconds }),
      ...(run?.rollingStock !== undefined && { rollingStock: run.rollingStock }),
    };
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
