import type {
  DelayByHour,
  HourPunctuality,
  LinePunctuality,
  PunctualityRanking,
} from '@stt/contracts';
import { serviceDateFor } from '../../domain/movement/service-date.js';
import type { PunctualityReader } from './punctuality.reader.js';

export const DEFAULT_DAYS = 7;
/** A Line needs this many Runs in the window to be ranked: fewer is noise. */
export const DEFAULT_MIN_RUNS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const since = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

export interface PunctualityQuery {
  readonly days?: number;
}

/** First Service date of a window of `days` days: today's Madrid date minus `days`, `YYYY-MM-DD`. */
function sinceServiceDate(now: Date, days: number): string {
  const since = new Date(`${serviceDateFor(now)}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - days);
  return since.toISOString().slice(0, 10);
}

/**
 * Lines ranked from least to most on-time share of Runs over the last `days` days (ADR 0007):
 * each Run counts once, by its final Delay.
 */
export class GetPunctualityRanking {
  constructor(
    private readonly reader: PunctualityReader,
    private readonly now: () => Date = () => new Date(),
    private readonly minRuns: number = DEFAULT_MIN_RUNS,
  ) {}

  async execute(query: PunctualityQuery = {}): Promise<PunctualityRanking> {
    const days = query.days ?? DEFAULT_DAYS;
    const totals = (await this.reader.lineRunTotals(sinceServiceDate(this.now(), days))).filter(
      (line) => line.runs >= this.minRuns,
    );
    const lines: LinePunctuality[] = totals
      .map((line) => ({
        lineCode: line.lineCode,
        name: line.name,
        serviceType: line.serviceType,
        ...(line.hubCode !== undefined && { hubCode: line.hubCode }),
        runs: line.runs,
        onTimePct: (100 * line.onTimeRuns) / line.runs,
        avgSeconds: line.totalFinalSeconds / line.runs,
      }))
      .sort(
        (a, b) =>
          a.onTimePct - b.onTimePct || b.runs - a.runs || a.lineCode.localeCompare(b.lineCode),
      );
    const runs = totals.reduce((sum, line) => sum + line.runs, 0);
    const onTimeRuns = totals.reduce((sum, line) => sum + line.onTimeRuns, 0);
    const overall = runs === 0 ? null : { runs, onTimePct: (100 * onTimeRuns) / runs };
    return { days, overall, lines };
  }
}

export interface DelayByHourQuery extends PunctualityQuery {
  readonly lineCode?: string;
}

/** Delay observations pooled by Madrid hour of day over the last `days` days, for every Line or for one. */
export class GetDelayByHour {
  constructor(
    private readonly reader: PunctualityReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(query: DelayByHourQuery = {}): Promise<DelayByHour> {
    const days = query.days ?? DEFAULT_DAYS;
    const totals = await this.reader.hourTotals(since(this.now(), days), query.lineCode);
    const byHour = new Map(totals.map((row) => [row.hour, row]));
    const hours: HourPunctuality[] = Array.from({ length: 24 }, (_, hour) => {
      const row = byHour.get(hour);
      if (!row || row.observations === 0) {
        return { hour, observations: 0, avgSeconds: null, onTimePct: null };
      }
      return {
        hour,
        observations: row.observations,
        avgSeconds: row.totalSeconds / row.observations,
        onTimePct: (100 * row.onTimeObservations) / row.observations,
      };
    });
    return { days, ...(query.lineCode !== undefined && { lineCode: query.lineCode }), hours };
  }
}
