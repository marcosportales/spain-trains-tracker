import { type BoundingBox, OsmRailways } from '../../application/network/osm-railways.js';
import type { OsmWay } from '../../domain/network/index.js';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface OverpassRailwaysOptions {
  readonly url?: string;
  readonly fetch?: typeof fetch;
  /** Pause before every request, to stay polite to the public Overpass instance. */
  readonly delayMs?: number;
}

interface OverpassResponse {
  readonly elements?: readonly {
    readonly type: string;
    readonly geometry?: readonly { readonly lat: number; readonly lon: number }[];
  }[];
}

/** Reads main-line railway ways from the Overpass API. */
export class OverpassRailways extends OsmRailways {
  private readonly url: string;
  private readonly fetchFn: typeof fetch;
  private readonly delayMs: number;

  constructor(options: OverpassRailwaysOptions = {}) {
    super();
    this.url = options.url ?? OVERPASS_URL;
    this.fetchFn = options.fetch ?? fetch;
    this.delayMs = options.delayMs ?? 1_000;
  }

  async mainLinesWithin({ south, west, north, east }: BoundingBox): Promise<OsmWay[]> {
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const query = `[out:json][timeout:90];way["railway"="rail"][!"service"](${south},${west},${north},${east});out geom;`;
    const response = await this.fetchFn(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query }),
    });
    if (!response.ok) throw new Error(`Overpass answered ${response.status}`);
    const body = (await response.json()) as OverpassResponse;
    return (body.elements ?? [])
      .filter((element) => element.type === 'way' && (element.geometry?.length ?? 0) >= 2)
      .map((element) =>
        (element.geometry ?? []).map(({ lon, lat }) => [lon, lat] as readonly [number, number]),
      );
  }
}
