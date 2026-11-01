import type {
  DelayByHour,
  HourPunctuality,
  LinePunctuality,
  PunctualityRanking,
} from '@stt/contracts';
import type { PunctualityReader } from './punctuality.reader.js';

export const DEFAULT_DAYS = 7;
/** A Line needs this many Delay observations in the window to be ranked: fewer is noise. */
export const DEFAULT_MIN_OBSERVATIONS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const since = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

export interface PunctualityQuery {
  readonly days?: number;
}

/** Lines ranked from least to most on-time share over the last `days` days. */
export class GetPunctualityRanking {
  constructor(
    private readonly reader: PunctualityReader,
    private readonly now: () => Date = () => new Date(),
    private readonly minObservations: number = DEFAULT_MIN_OBSERVATIONS,
  ) {}

  async execute(query: PunctualityQuery = {}): Promise<PunctualityRanking> {
    const days = query.days ?? DEFAULT_DAYS;
    const totals = await this.reader.lineTotals(since(this.now(), days));
    const lines: LinePunctuality[] = totals
      .filter((line) => line.observations >= this.minObservations)
      .map((line) => ({
        lineCode: line.lineCode,
        name: line.name,
        serviceType: line.serviceType,
        ...(line.hubCode !== undefined && { hubCode: line.hubCode }),
        observations: line.observations,
        onTimePct: (100 * line.onTimeObservations) / line.observations,
        avgSeconds: line.totalSeconds / line.observations,
      }))
      .sort(
        (a, b) =>
          a.onTimePct - b.onTimePct ||
          b.observations - a.observations ||
          a.lineCode.localeCompare(b.lineCode),
      );
    return { days, lines };
  }
}

export interface DelayByHourQuery extends PunctualityQuery {
  readonly lineCode?: string;
}

/** Delay pooled by Madrid hour of day over the last `days` days, for every Line or for one. */
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
