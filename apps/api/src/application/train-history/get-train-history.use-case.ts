import type { TrainHistory, TrainHistoryRun } from '@stt/contracts';
import { normalizeTrainNumber } from '../../domain/movement/index.js';
import type { TrainHistoryReader } from './train-history.reader.js';

export const DEFAULT_DAYS = 30;
/** A Run counts as on time when its average Delay is at most 5 min. */
const ON_TIME_SECONDS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;

const median = (sorted: readonly number[]): number => {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

export interface TrainHistoryQuery {
  readonly days?: number;
}

/** How a Train number behaved over the last `days` Service dates ("usually 7 min late"). */
export class GetTrainHistory {
  constructor(
    private readonly reader: TrainHistoryReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(rawTrainNumber: string, query: TrainHistoryQuery = {}): Promise<TrainHistory> {
    const trainNumber = normalizeTrainNumber(rawTrainNumber);
    const days = query.days ?? DEFAULT_DAYS;
    const since = new Date(this.now().getTime() - days * DAY_MS).toISOString().slice(0, 10);
    const totals = await this.reader.runTotals(trainNumber, since);

    const runs: TrainHistoryRun[] = totals
      .filter((run) => run.observations > 0)
      .map((run) => ({
        serviceDate: run.serviceDate,
        observations: run.observations,
        avgSeconds: run.totalSeconds / run.observations,
        maxSeconds: run.maxSeconds,
      }))
      .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
    if (runs.length === 0) return { trainNumber, days, runs };

    const averages = runs.map((run) => run.avgSeconds).sort((a, b) => a - b);
    const onTime = averages.filter((seconds) => seconds <= ON_TIME_SECONDS).length;
    return {
      trainNumber,
      days,
      summary: {
        runs: runs.length,
        typicalSeconds: median(averages),
        onTimePct: (100 * onTime) / runs.length,
      },
      runs,
    };
  }
}
