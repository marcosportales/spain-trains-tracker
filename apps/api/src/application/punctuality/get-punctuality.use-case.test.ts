import { describe, expect, it } from 'vitest';
import { GetPunctualityRanking } from './get-punctuality.use-case.js';
import { type LineRunTotals, PunctualityReader } from './punctuality.reader.js';

class FakeReader extends PunctualityReader {
  sinceServiceDate: string | undefined;
  constructor(private readonly totals: LineRunTotals[]) {
    super();
  }
  async lineRunTotals(sinceServiceDate: string): Promise<LineRunTotals[]> {
    this.sinceServiceDate = sinceServiceDate;
    return this.totals;
  }
  async hourTotals(): Promise<never[]> {
    return [];
  }
}

const line = (lineCode: string, runs: number, onTimeRuns: number, totalFinalSeconds = 0) =>
  ({
    lineCode,
    name: lineCode,
    serviceType: 'cercanias',
    runs,
    onTimeRuns,
    totalFinalSeconds,
  }) satisfies LineRunTotals;

// 00:30 on 2026-11-01 in Madrid (CET) is still 2026-10-31 in UTC.
const NOW = new Date('2026-10-31T23:30:00Z');

describe('GetPunctualityRanking', () => {
  it('leaves out Lines with fewer Runs than the minimum', async () => {
    const reader = new FakeReader([line('C1', 10, 5), line('C2', 9, 9)]);
    const ranking = await new GetPunctualityRanking(reader, () => NOW).execute();
    expect(ranking.lines.map((l) => l.lineCode)).toEqual(['C1']);
  });

  it('computes figures from Runs: share on time and average final Delay', async () => {
    const reader = new FakeReader([line('C1', 4, 3, 1200)]);
    const ranking = await new GetPunctualityRanking(reader, () => NOW, 1).execute();
    expect(ranking.lines).toEqual([
      {
        lineCode: 'C1',
        name: 'C1',
        serviceType: 'cercanias',
        runs: 4,
        onTimePct: 75,
        avgSeconds: 300,
      },
    ]);
  });

  it('weights overall by Runs rather than averaging percentages', async () => {
    // 90 % of 100 Runs and 10 % of 10 Runs: 91 of 110 Runs = 82.7 %, not 50 %.
    const reader = new FakeReader([line('C1', 100, 90), line('C2', 10, 1)]);
    const ranking = await new GetPunctualityRanking(reader, () => NOW).execute();
    expect(ranking.overall?.runs).toBe(110);
    expect(ranking.overall?.onTimePct).toBeCloseTo(82.727, 3);
  });

  it('computes overall from the ranked Lines only', async () => {
    const reader = new FakeReader([line('C1', 20, 20), line('C2', 5, 0)]);
    const ranking = await new GetPunctualityRanking(reader, () => NOW).execute();
    expect(ranking.overall).toEqual({ runs: 20, onTimePct: 100 });
  });

  it('has a null overall when no Line is ranked', async () => {
    expect(await new GetPunctualityRanking(new FakeReader([]), () => NOW).execute()).toEqual({
      days: 7,
      overall: null,
      lines: [],
    });
    const few = new FakeReader([line('C1', 3, 3)]);
    expect((await new GetPunctualityRanking(few, () => NOW).execute()).overall).toBeNull();
  });

  it('sorts by on time share ascending, then more Runs first, then Line code', async () => {
    const reader = new FakeReader([
      line('C4', 20, 10),
      line('C3', 40, 20),
      line('C2', 40, 20),
      line('C1', 10, 9),
    ]);
    const ranking = await new GetPunctualityRanking(reader, () => NOW).execute();
    expect(ranking.lines.map((l) => l.lineCode)).toEqual(['C2', 'C3', 'C4', 'C1']);
  });

  it("windows by Service date: today's Madrid date minus days", async () => {
    const reader = new FakeReader([]);
    const useCase = new GetPunctualityRanking(reader, () => NOW);
    await useCase.execute();
    expect(reader.sinceServiceDate).toBe('2026-10-25'); // Madrid is already 2026-11-01
    await useCase.execute({ days: 30 });
    expect(reader.sinceServiceDate).toBe('2026-10-02');
  });
});
