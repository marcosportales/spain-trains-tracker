import type { OsmWay } from '../../domain/network/index.js';

export interface BoundingBox {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/** OpenStreetMap railway data. */
export abstract class OsmRailways {
  /** Main-line railway ways (no sidings, yards or spurs) that touch the box. */
  abstract mainLinesWithin(box: BoundingBox): Promise<OsmWay[]>;
}
