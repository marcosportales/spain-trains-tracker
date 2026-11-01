import { LiveSnapshot } from '@stt/contracts';
import { describe, expect, it } from 'vitest';
import { createDelay, createRunId, createSighting } from '../../domain/movement/index.js';
import { createHub, createLine } from '../../domain/network/index.js';
import type { NetworkRepository } from '../network/network.repository.js';
import { GetLiveSnapshot, UnknownLiveFilterError } from './get-live-snapshot.use-case.js';
import type { LiveRunsFilter, LiveRunsReader, RecentRun } from './live-runs.reader.js';

const NOW = new Date('2026-10-31T10:15:30Z');
const runId = createRunId('3063', '2026-10-31');

class FakeReader implements LiveRunsReader {
  calls: { since: Date; filter: LiveRunsFilter }[] = [];
  constructor(private readonly runs: RecentRun[]) {}
  async listRecentRuns(since: Date, filter: LiveRunsFilter) {
    this.calls.push({ since, filter });
    return this.runs;
  }
}

const network = {
  listHubs: async () => [createHub('10')],
  listLines: async () => [
    createLine({ code: '10-C1', name: 'C1 Madrid', serviceType: 'cercanias' }),
  ],
} as unknown as NetworkRepository;

function recent(overrides: Partial<RecentRun> = {}): RecentRun {
  return {
    runId,
    serviceType: 'ave',
    sightings: [
      createSighting({
        runId,
        source: 'gtfsrt_ld',
        observedAt: new Date('2026-10-31T10:15:00Z'),
        lat: 40.4,
        lon: -3.7,
        status: 'IN_TRANSIT_TO',
        stationCode: '60000',
      }),
    ],
    ...overrides,
  };
}

const useCase = (runs: RecentRun[], reader = new FakeReader(runs)) => ({
  reader,
  snapshot: new GetLiveSnapshot(reader, network, () => NOW),
});

describe('GetLiveSnapshot', () => {
  it('returns a LiveSnapshot valid against the contract', async () => {
    const { snapshot } = useCase([
      recent({
        lineCode: '10-C1',
        delay: createDelay({ runId, source: 'gtfsrt_ld', observedAt: NOW, seconds: 120 }),
      }),
    ]);
    const result = await snapshot.execute({});
    expect(LiveSnapshot.parse(result)).toEqual(result);
    expect(result.generatedAt).toBe('2026-10-31T10:15:30.000Z');
    expect(result.cycleId).toBe(NOW.getTime());
    expect(result.runs).toEqual([
      {
        trainNumber: '03063',
        serviceDate: '2026-10-31',
        serviceType: 'ave',
        lineCode: '10-C1',
        lat: 40.4,
        lon: -3.7,
        status: 'in_transit_to',
        delaySeconds: 120,
        nextStationCode: '60000',
        sources: ['official'],
        observedAt: '2026-10-31T10:15:00.000Z',
      },
    ]);
  });

  it('asks for Runs seen in the last 3 minutes', async () => {
    const { reader, snapshot } = useCase([]);
    await snapshot.execute({});
    expect(reader.calls[0]?.since).toEqual(new Date('2026-10-31T10:12:30Z'));
  });

  it('merges Sources into one Run: the real GPS fix wins, sources are contract Sources', async () => {
    const gps = createSighting({
      runId,
      source: 'visor_ld',
      observedAt: new Date('2026-10-31T10:14:00Z'),
      lat: 41,
      lon: 2,
      status: 'IN_TRANSIT_TO',
    });
    const snapped = createSighting({
      runId,
      source: 'gtfsrt_ld',
      observedAt: new Date('2026-10-31T10:15:00Z'),
      lat: 40,
      lon: -3,
      status: 'STOPPED_AT',
      positionIsSnapped: true,
    });
    const { snapshot } = useCase([recent({ sightings: [snapped, gps] })]);
    const [run] = (await snapshot.execute({})).runs;
    expect(run).toMatchObject({ lat: 41, lon: 2, sources: ['official', 'visor'] });
  });

  it('passes the filters to the reader', async () => {
    const { reader, snapshot } = useCase([]);
    await snapshot.execute({ serviceType: 'cercanias', hubCode: '10', lineCode: '10-C1' });
    expect(reader.calls[0]?.filter).toEqual({
      serviceType: 'cercanias',
      hubCode: '10',
      lineCode: '10-C1',
    });
  });

  it('rejects an unknown Hub or Line', async () => {
    const { snapshot } = useCase([]);
    await expect(snapshot.execute({ hubCode: '99' })).rejects.toBeInstanceOf(
      UnknownLiveFilterError,
    );
    await expect(snapshot.execute({ lineCode: 'ZZ' })).rejects.toBeInstanceOf(
      UnknownLiveFilterError,
    );
  });

  it('orders Runs by service date then Train number', async () => {
    const a = createRunId('100', '2026-10-31');
    const b = createRunId('50', '2026-10-31');
    const mk = (id: typeof a) =>
      recent({ runId: id, sightings: recent().sightings.map((s) => ({ ...s, runId: id })) });
    const { snapshot } = useCase([mk(a), mk(b)]);
    const trains = (await snapshot.execute({})).runs.map((r) => r.trainNumber);
    expect(trains).toEqual(['00050', '00100']);
  });
});
