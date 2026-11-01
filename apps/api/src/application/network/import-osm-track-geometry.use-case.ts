import { createHash } from 'node:crypto';
import { matchTrackGeometry, type Station } from '../../domain/network/index.js';
import type { ImportLogger } from './import-static-network.use-case.js';
import type { NetworkRepository, StopPattern } from './network.repository.js';
import type { BoundingBox, OsmRailways } from './osm-railways.js';

export interface OsmGeometryReport {
  /** Distinct stop patterns of the non-Cercanías Lines. */
  readonly patterns: number;
  /** Patterns that got a new Track geometry from OpenStreetMap. */
  readonly drawn: number;
  /** Patterns whose geometry already existed (their new Runs were linked to it). */
  readonly alreadyDrawn: number;
  /** Patterns left without geometry (unknown Stations, no track found, or the request failed). */
  readonly skipped: number;
}

/** How far around the Stations to look for track, in degrees (~5.5 km). */
const BOX_PADDING_DEGREES = 0.05;

/** At least this share of a pattern's Stations must lie on the drawn track. */
const MIN_MATCHED_SHARE = 0.6;

/**
 * Draws the Track geometry of AVE / Larga Distancia / Media Distancia Runs, which GTFS ships
 * without `shapes.txt`: for each distinct sequence of Stations a Line's Runs stop at, it downloads
 * the OpenStreetMap main-line track around them, map-matches the Stations and stores the path.
 * Idempotent: patterns already drawn are only linked to their Runs.
 */
export class ImportOsmTrackGeometry {
  constructor(
    private readonly repository: NetworkRepository,
    private readonly railways: OsmRailways,
    private readonly logger: ImportLogger = console,
  ) {}

  async execute(): Promise<OsmGeometryReport> {
    const patterns = await this.repository.listLongDistanceStopPatterns();
    const stations = new Map((await this.repository.listStations()).map((s) => [s.code, s]));
    const shapeIds = patterns.map(shapeIdOf);
    const existing = await this.repository.existingShapeIds(shapeIds);

    let drawn = 0;
    let alreadyDrawn = 0;
    let skipped = 0;
    for (const [i, pattern] of patterns.entries()) {
      const shapeId = shapeIds[i] as string;
      if (existing.has(shapeId)) {
        await this.repository.linkRunsToShape(shapeId, pattern.tripIds);
        alreadyDrawn++;
        continue;
      }
      try {
        const path = await this.draw(pattern, stations);
        if (path === undefined) {
          skipped++;
          continue;
        }
        await this.repository.saveTrackGeometry(
          { shapeId, lineCode: pattern.lineCode, path },
          pattern.tripIds,
        );
        drawn++;
      } catch (error) {
        skipped++;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`osm geometry of ${shapeId} failed: ${message}`);
      }
    }
    this.logger.log(
      `osm track geometry: ${drawn} drawn, ${alreadyDrawn} already drawn, ${skipped} skipped of ${patterns.length} patterns`,
    );
    return { patterns: patterns.length, drawn, alreadyDrawn, skipped };
  }

  private async draw(
    pattern: StopPattern,
    known: ReadonlyMap<string, Station>,
  ): Promise<[number, number][] | undefined> {
    const stops = pattern.stationCodes
      .filter((code, i, all) => code !== all[i - 1])
      .map((code) => known.get(code))
      .filter((station): station is Station => station !== undefined);
    if (stops.length < 2) return undefined;
    const ways = await this.railways.mainLinesWithin(boxAround(stops));
    const match = matchTrackGeometry(ways, stops);
    // A path that misses most Stations would pass for the whole Line: better none than that.
    if (match === undefined || match.matchedStations < stops.length * MIN_MATCHED_SHARE) {
      return undefined;
    }
    return match.path;
  }
}

/** Deterministic, so the same stop pattern keeps the same shape across imports. */
export function shapeIdOf(pattern: StopPattern): string {
  const hash = createHash('sha1').update(pattern.stationCodes.join(',')).digest('hex').slice(0, 8);
  const first = pattern.stationCodes[0];
  const last = pattern.stationCodes.at(-1);
  return `osm:${pattern.lineCode}:${first}-${last}-${hash}`;
}

function boxAround(stations: readonly Station[]): BoundingBox {
  const lats = stations.map((s) => s.lat);
  const lons = stations.map((s) => s.lon);
  return {
    south: Math.min(...lats) - BOX_PADDING_DEGREES,
    north: Math.max(...lats) + BOX_PADDING_DEGREES,
    west: Math.min(...lons) - BOX_PADDING_DEGREES,
    east: Math.max(...lons) + BOX_PADDING_DEGREES,
  };
}
