import type { ServiceType } from '../../domain/network/index.js';

/** One scheduled stop of a Run at a Station on a Service date, with what is known live about the Run. */
export interface StationPass {
  readonly trainNumber: string;
  readonly serviceDate: string;
  readonly serviceType: ServiceType;
  readonly lineCode: string;
  /** Timetable seconds since the start of the Service date; may exceed 24h. */
  readonly arrivalSeconds: number;
  readonly departureSeconds: number;
  /** The Run's first and last scheduled stop. */
  readonly originStationCode: string;
  readonly destinationStationCode: string;
  /** This stop is the Run's first (so no arrival is listed) or last (so no departure is listed). */
  readonly isFirstStop: boolean;
  readonly isLastStop: boolean;
  readonly serviceStatus?: 'scheduled' | 'cancelled';
  /** The Run's newest Delay. */
  readonly delaySeconds?: number;
  /** Times the Visor feed reported for this Station. */
  readonly estimatedArrival?: Date;
  readonly estimatedDeparture?: Date;
}

/** Read side of the Station board: the timetable at one Station joined with live Run state. */
export abstract class StationBoardReader {
  /**
   * Stops at `stationCode` of Runs operating on `serviceDate` (via calendar and calendar dates) whose
   * time at the Station may fall between `fromSeconds` and `toSeconds` of that Service date.
   */
  abstract listPasses(
    stationCode: string,
    serviceDate: string,
    fromSeconds: number,
    toSeconds: number,
  ): Promise<StationPass[]>;
}
