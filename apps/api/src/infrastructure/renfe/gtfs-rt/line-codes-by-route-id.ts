import type { LineCodeLookup } from './gtfs-rt-alerts.source.js';

/** `<hub code><"T"><4 digits><short name>`, e.g. `10T0003C10`: the Line is `10-C10`. */
const CERCANIAS_ROUTE_ID = /^(\d{2})T\d{4}(.+)$/;

/**
 * Resolves Cercanías GTFS `route_id`s to Line codes. The static import names a Line
 * `<hub code>-<short name>` and the route id carries both parts, so no route table is stored;
 * a derived code counts only when that Line exists.
 */
export class LineCodesByRouteId implements LineCodeLookup {
  constructor(private readonly network: { listLines(): Promise<readonly { code: string }[]> }) {}

  async lineCodesForRouteIds(routeIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const known = new Set((await this.network.listLines()).map((line) => line.code));
    const result = new Map<string, string>();
    for (const routeId of routeIds) {
      const match = CERCANIAS_ROUTE_ID.exec(routeId.trim());
      const code = match ? `${match[1]}-${match[2]?.trim()}` : undefined;
      if (code && known.has(code)) result.set(routeId, code);
    }
    return result;
  }
}
