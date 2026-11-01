import { z } from 'zod';
import {
  VisorFeed,
  type VisorFleet,
  type VisorFleetFeed,
} from '../../../application/realtime/visor-feed.js';
import {
  createDelay,
  createRun,
  createRunStopEstimate,
  createSighting,
  type Delay,
  InvalidMovementValueError,
  normalizeTrainNumber,
  type Run,
  type RunStopEstimate,
  type Sighting,
  type Source,
} from '../../../domain/movement/index.js';
import type { ScheduledRun, ServiceType } from '../../../domain/network/index.js';
import {
  runIdAt,
  type ScheduledRunLookup,
  type SkippedEntity,
  scheduledRunsByTripId,
  trimmedOrUndefined,
} from '../gtfs-rt/gtfs-rt-common.js';
import { madridLocalToDate, parseMadridLocalTimestamp } from './madrid-time.js';

export type { SkippedEntity };

export const RENFE_VISOR_URLS = {
  'larga-distancia': 'https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json',
  cercanias: 'https://tiempo-real.renfe.com/renfe-visor/flota.json',
  stops: 'https://tiempo-real.largorecorrido.renfe.com/renfe-visor/trenesConEstacionesLD.json',
} as const;

const SOURCE_OF: Readonly<Record<VisorFleetFeed, Source>> = {
  'larga-distancia': 'visor_ld',
  cercanias: 'visor_cercanias',
};

const text = z.string().trim().min(1);
const minutes = z
  .union([
    z
      .string()
      .trim()
      .regex(/^-?\d+$/, 'must be whole minutes'),
    z.number().int(),
  ])
  .transform(Number);

const envelope = z.object({ fechaActualizacion: z.string(), trenes: z.array(z.unknown()) });

const coordinates = {
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
};

const longDistanceTrain = z.object({
  codComercial: text,
  codEstSig: text,
  codEstAnt: z.string().nullish(),
  ultRetraso: minutes.nullish(),
  time: z.number().positive().nullish(),
  p: z.string().nullish(),
  mat: z.string().nullish(),
  accesible: z.boolean().nullish(),
  ...coordinates,
});

const cercaniasTrain = z.object({
  codTren: text,
  codEstSig: text,
  codEstAct: z.string().nullish(),
  tripId: z.string().nullish(),
  codLinea: z.string().nullish(),
  retrasoMin: minutes.nullish(),
  // "A" while the train is at a platform; a percentage or "E" while it is between Stations.
  porAvanc: z.string().nullish(),
  via: z.string().nullish(),
  nextVia: z.string().nullish(),
  accesible: z.boolean().nullish(),
  ...coordinates,
});

const CLOCK = /^\d{1,2}:\d{2}$/;
const stopsTrain = z.object({
  idTren: text,
  estaciones: z.array(z.unknown()),
});
const stopTimes = z.object({
  p: text,
  h: z.string().regex(CLOCK),
  hs: z.string().regex(CLOCK),
});

export interface RenfeVisorFeedOptions {
  readonly timetable: ScheduledRunLookup;
  readonly now?: () => Date;
  /** Called for each entity left out of the result. */
  readonly onSkipped?: (problem: SkippedEntity) => void;
}

/**
 * Reads Renfe's visor JSON: `flotaLD.json`, `flota.json` and `trenesConEstacionesLD.json`.
 *
 * - Run: the Train number (`codComercial` / `codTren`) on the Service date of `observedAt`. Typed
 *   only from the timetable (Cercanías: by trip id), never guessed: the Official feeds own a Run's
 *   type, so a Run unknown to the timetable gets Sightings and a Delay but no Run (and no Rolling
 *   stock).
 * - observedAt: `time` (LD), else the file's `fechaActualizacion` (Madrid local time).
 * - Delay: `ultRetraso` / `retrasoMin` minutes → seconds, at the next Station.
 * - Status: a train at its previous Station (LD: previous = next) or on a platform (Cercanías
 *   `porAvanc` "A") is `STOPPED_AT`; every other train is `IN_TRANSIT_TO` its next Station.
 * - Station estimates: the file's scheduled times (Madrid local) plus the Run's Delay.
 *
 * Schema drift is expected from an unofficial feed: an entity missing a required field is reported
 * to `onSkipped` and left out; a body that is not a visor file rejects.
 */
export class RenfeVisorFeed extends VisorFeed {
  private readonly timetable: ScheduledRunLookup;
  private readonly now: () => Date;
  private readonly onSkipped: (problem: SkippedEntity) => void;

  constructor(options: RenfeVisorFeedOptions) {
    super();
    this.timetable = options.timetable;
    this.now = options.now ?? (() => new Date());
    this.onSkipped = options.onSkipped ?? (() => {});
  }

  async readFleet(feed: VisorFleetFeed, body: Uint8Array): Promise<VisorFleet> {
    const { updatedAt, trains } = this.parseEnvelope(body);
    const fleet: VisorFleet = { sightings: [], delays: [], runs: [] };
    const scheduledByTrip =
      feed === 'cercanias'
        ? await scheduledRunsByTripId(
            this.timetable,
            trains.map((t) => trimmedOrUndefined((t as { tripId?: string } | null)?.tripId)),
          )
        : new Map<string, ScheduledRun>();

    for (const [index, raw] of trains.entries()) {
      const id = entityId(raw, index);
      try {
        const reading =
          feed === 'larga-distancia'
            ? this.longDistance(raw, updatedAt)
            : this.cercanias(raw, updatedAt, scheduledByTrip);
        const result = await reading;
        if (result === undefined) continue;
        fleet.sightings.push(result.sighting);
        if (result.delay) fleet.delays.push(result.delay);
        if (result.run) fleet.runs.push(result.run);
      } catch (error) {
        this.onSkipped({ entityId: id, reason: skipReason(error) });
      }
    }
    return fleet;
  }

  async readStopEstimates(body: Uint8Array, delays: readonly Delay[]): Promise<RunStopEstimate[]> {
    const { trains } = this.parseEnvelope(body);
    const delayOf = new Map(delays.map((d) => [d.runId.trainNumber, d]));
    const estimates: RunStopEstimate[] = [];

    for (const [index, raw] of trains.entries()) {
      const id = entityId(raw, index);
      try {
        const train = parse(stopsTrain, raw);
        const delay = delayOf.get(normalizeTrainNumber(train.idTren));
        // Not drift: the stops file lists trains the fleet file does not (yet) report.
        if (!delay) continue;
        estimates.push(...this.stopsOf(train, delay));
      } catch (error) {
        this.onSkipped({ entityId: id, reason: skipReason(error) });
      }
    }
    return estimates;
  }

  private parseEnvelope(body: Uint8Array): { updatedAt: Date; trains: unknown[] } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(body));
    } catch {
      throw new Error('Not a visor file: body is not JSON');
    }
    const result = envelope.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Not a visor file: ${describe(result.error)}`);
    }
    return {
      updatedAt: parseMadridLocalTimestamp(result.data.fechaActualizacion) ?? this.now(),
      trains: result.data.trenes,
    };
  }

  private async longDistance(raw: unknown, updatedAt: Date): Promise<Reading | undefined> {
    const train = parse(longDistanceTrain, raw);
    const observedAt = train.time ? new Date(train.time * 1000) : updatedAt;
    const runId = await runIdAt(this.timetable, train.codComercial, observedAt, undefined);
    const scheduled = (
      await this.timetable.findScheduledRuns(runId.trainNumber, runId.serviceDate)
    )[0];
    const source = SOURCE_OF['larga-distancia'];
    const stopped = train.codEstAnt?.trim() === train.codEstSig;
    const platform = trimmedOrUndefined(train.p);

    return {
      sighting: createSighting({
        runId,
        source,
        observedAt,
        lat: train.latitud,
        lon: train.longitud,
        status: stopped ? 'STOPPED_AT' : 'IN_TRANSIT_TO',
        stationCode: train.codEstSig,
        ...(platform && { platform }),
      }),
      ...(train.ultRetraso != null && {
        delay: createDelay({
          runId,
          source,
          observedAt,
          seconds: train.ultRetraso * 60,
          atStationCode: train.codEstSig,
        }),
      }),
      ...(scheduled && {
        run: this.run(runId, scheduled.serviceType, scheduled.lineCode, train),
      }),
    };
  }

  private async cercanias(
    raw: unknown,
    observedAt: Date,
    scheduledByTrip: Map<string, ScheduledRun>,
  ): Promise<Reading | undefined> {
    const train = parse(cercaniasTrain, raw);
    const tripId = trimmedOrUndefined(train.tripId);
    const scheduled = tripId === undefined ? undefined : scheduledByTrip.get(tripId);
    const runId = await runIdAt(this.timetable, train.codTren, observedAt, scheduled);
    const source = SOURCE_OF.cercanias;
    const atPlatform = train.porAvanc?.trim() === 'A';
    const currentStation = trimmedOrUndefined(train.codEstAct);
    const stationCode = atPlatform && currentStation ? currentStation : train.codEstSig;
    const platform = trimmedOrUndefined(atPlatform ? train.via : train.nextVia);
    const lineCode = scheduled?.lineCode ?? trimmedOrUndefined(train.codLinea);

    return {
      sighting: createSighting({
        runId,
        source,
        observedAt,
        lat: train.latitud,
        lon: train.longitud,
        status: atPlatform && currentStation ? 'STOPPED_AT' : 'IN_TRANSIT_TO',
        stationCode,
        ...(platform && { platform }),
      }),
      ...(train.retrasoMin != null && {
        delay: createDelay({
          runId,
          source,
          observedAt,
          seconds: train.retrasoMin * 60,
          atStationCode: train.codEstSig,
        }),
      }),
      ...(scheduled && {
        run: this.run(runId, scheduled.serviceType, lineCode, { accesible: train.accesible }),
      }),
    };
  }

  private run(
    runId: Run['id'],
    serviceType: ServiceType,
    lineCode: string | undefined,
    train: { mat?: string | null | undefined; accesible?: boolean | null | undefined },
  ): Run {
    const rollingStock = trimmedOrUndefined(train.mat);
    return createRun({
      id: runId,
      serviceType,
      ...(lineCode && { lineCode }),
      ...(train.accesible != null && { wheelchairAccessible: train.accesible }),
      ...(rollingStock && { rollingStock }),
    });
  }

  private stopsOf(train: z.output<typeof stopsTrain>, delay: Delay): RunStopEstimate[] {
    const estimates: RunStopEstimate[] = [];
    let dayOffset = 0;
    let previous = Number.NEGATIVE_INFINITY;
    /** Times only move forward: a clock that goes back means the journey passed midnight. */
    const advance = (clock: string): Date => {
      const [hour, minute] = clock.split(':').map(Number) as [number, number];
      let at = madridLocalToDate(delay.runId.serviceDate, hour, minute, 0, dayOffset);
      if (at.getTime() < previous) {
        dayOffset += 1;
        at = madridLocalToDate(delay.runId.serviceDate, hour, minute, 0, dayOffset);
      }
      previous = at.getTime();
      return at;
    };

    for (const [sequence, rawStop] of train.estaciones.entries()) {
      const stop = stopTimes.safeParse(rawStop);
      if (!stop.success) {
        this.onSkipped({
          entityId: `${train.idTren}#${sequence}`,
          reason: describe(stop.error),
        });
        continue;
      }
      const scheduledArrival = advance(stop.data.h);
      const scheduledDeparture = advance(stop.data.hs);
      estimates.push(
        createRunStopEstimate({
          runId: delay.runId,
          sequence,
          stationCode: stop.data.p,
          scheduledArrival,
          scheduledDeparture,
          estimatedArrival: new Date(scheduledArrival.getTime() + delay.seconds * 1000),
          estimatedDeparture: new Date(scheduledDeparture.getTime() + delay.seconds * 1000),
        }),
      );
    }
    return estimates;
  }
}

interface Reading {
  sighting: Sighting;
  delay?: Delay;
  run?: Run;
}

class DriftError extends Error {}

/** Why an entity is left out; anything that is not bad data is a real failure and is rethrown. */
function skipReason(error: unknown): string {
  if (error instanceof InvalidMovementValueError || error instanceof DriftError) {
    return error.message;
  }
  throw error;
}

function parse<T extends z.ZodType>(schema: T, raw: unknown): z.output<T> {
  const result = schema.safeParse(raw);
  if (!result.success) throw new DriftError(describe(result.error));
  return result.data;
}

function describe(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ');
}

function entityId(raw: unknown, index: number): string {
  const record = (raw ?? {}) as Record<string, unknown>;
  for (const key of ['codComercial', 'codTren', 'idTren']) {
    if (typeof record[key] === 'string' && record[key]) return record[key] as string;
  }
  return `#${index}`;
}
