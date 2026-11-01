import type { StationBoard, StationBoardEntry } from '@stt/contracts';
import { madridLocalToDate } from '../../domain/movement/index.js';
import type { NetworkRepository } from '../network/network.repository.js';
import type { StationBoardReader, StationPass } from './station-board.reader.js';

/** The board covers this long from its start time. */
export const BOARD_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface StationBoardQuery {
  readonly stationCode: string;
  /** Which side to list; the other stays empty. Both when omitted. */
  readonly type?: 'departures' | 'arrivals';
  /** Start of the window. Defaults to now. */
  readonly from?: Date;
}

/** No Station has that code. */
export class StationNotFoundError extends Error {
  constructor(readonly stationCode: string) {
    super(`Unknown Station ${stationCode}`);
    this.name = 'StationNotFoundError';
  }
}

/**
 * The next 2 hours of departures and arrivals at a Station, from the timetable of every active
 * Service date (a Run past midnight still belongs to yesterday's), with live Delay and Service status.
 */
export class GetStationBoard {
  constructor(
    private readonly reader: StationBoardReader,
    private readonly network: NetworkRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(query: StationBoardQuery): Promise<StationBoard> {
    const station = await this.network.findStation(query.stationCode);
    if (!station) throw new StationNotFoundError(query.stationCode);

    const from = query.from ?? this.now();
    const to = new Date(from.getTime() + BOARD_WINDOW_MS);
    const departures: StationBoardEntry[] = [];
    const arrivals: StationBoardEntry[] = [];

    for (const serviceDate of candidateServiceDates(from)) {
      const midnight = madridLocalToDate(serviceDate, 0, 0, 0).getTime();
      // An hour of slack covers the clock change; exact filtering happens below.
      const fromSeconds = Math.floor((from.getTime() - midnight) / 1000) - 3600;
      const toSeconds = Math.ceil((to.getTime() - midnight) / 1000) + 3600;
      const passes = await this.reader.listPasses(
        query.stationCode,
        serviceDate,
        fromSeconds,
        toSeconds,
      );
      for (const pass of passes) {
        if (query.type !== 'arrivals' && !pass.isLastStop) {
          const entry = toEntry(pass, 'departure', from, to);
          if (entry) departures.push(entry);
        }
        if (query.type !== 'departures' && !pass.isFirstStop) {
          const entry = toEntry(pass, 'arrival', from, to);
          if (entry) arrivals.push(entry);
        }
      }
    }

    return {
      stationCode: station.code,
      stationName: station.name,
      departures: departures.sort(byTime),
      arrivals: arrivals.sort(byTime),
    };
  }
}

/** Service dates that can have Runs in the window: yesterday (past midnight), today and, near midnight, tomorrow. */
function candidateServiceDates(from: Date): string[] {
  const today = madridDate(from);
  return [addDays(today, -1), today, addDays(today, 1)].filter(
    (date) => madridLocalToDate(date, 0, 0, 0).getTime() <= from.getTime() + BOARD_WINDOW_MS,
  );
}

/** Steps a `YYYY-MM-DD` date by whole calendar days. */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const madridDate = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

function toEntry(
  pass: StationPass,
  side: 'departure' | 'arrival',
  from: Date,
  to: Date,
): StationBoardEntry | undefined {
  const seconds = side === 'departure' ? pass.departureSeconds : pass.arrivalSeconds;
  const scheduled = madridLocalToDate(pass.serviceDate, 0, 0, seconds);
  if (scheduled < from || scheduled >= to) return undefined;
  const visor = side === 'departure' ? pass.estimatedDeparture : pass.estimatedArrival;
  const estimated =
    visor ??
    (pass.delaySeconds !== undefined
      ? new Date(scheduled.getTime() + pass.delaySeconds * 1000)
      : undefined);
  return {
    trainNumber: pass.trainNumber,
    serviceDate: pass.serviceDate,
    serviceType: pass.serviceType,
    lineCode: pass.lineCode,
    counterpartStationCode:
      side === 'departure' ? pass.destinationStationCode : pass.originStationCode,
    scheduledAt: scheduled.toISOString(),
    ...(estimated && { estimatedAt: estimated.toISOString() }),
    ...(pass.delaySeconds !== undefined && { delaySeconds: pass.delaySeconds }),
    ...(pass.serviceStatus === 'cancelled' && { serviceStatus: pass.serviceStatus }),
  };
}

const byTime = (a: StationBoardEntry, b: StationBoardEntry) =>
  a.scheduledAt.localeCompare(b.scheduledAt) || a.trainNumber.localeCompare(b.trainNumber);
