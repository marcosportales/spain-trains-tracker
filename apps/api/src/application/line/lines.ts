import type { LineDto, TrackFeatureCollection } from '@stt/contracts';
import type { ServiceType } from '../../domain/network/index.js';
import type { NetworkRepository } from '../network/network.repository.js';

/** A filter names a Hub that does not exist. */
export class UnknownHubError extends Error {
  constructor(readonly hubCode: string) {
    super(`Unknown hub "${hubCode}"`);
    this.name = 'UnknownHubError';
  }
}

export interface LinesQuery {
  readonly serviceType?: ServiceType;
  readonly hubCode?: string;
}

async function selectLines(network: NetworkRepository, query: LinesQuery) {
  if (query.hubCode !== undefined) {
    const hubs = await network.listHubs();
    if (!hubs.some((hub) => hub.code === query.hubCode)) throw new UnknownHubError(query.hubCode);
  }
  const lines = await network.listLines();
  return lines.filter(
    (line) =>
      (query.serviceType === undefined || line.serviceType === query.serviceType) &&
      (query.hubCode === undefined || line.hubCode === query.hubCode),
  );
}

/** Lines, ordered by code. Their Track geometry is served separately by `GetLinesGeometry`. */
export class ListLines {
  constructor(private readonly network: NetworkRepository) {}

  async execute(query: LinesQuery = {}): Promise<LineDto[]> {
    const lines = await selectLines(this.network, query);
    return lines.map((line) => ({
      lineCode: line.code,
      name: line.name,
      serviceType: line.serviceType,
      ...(line.hubCode !== undefined && { hubCode: line.hubCode }),
      track: { type: 'FeatureCollection', features: [] },
    }));
  }
}

/** Simplified Track geometry of the Lines of a Hub (or of every Line), one Feature per shape. */
export class GetLinesGeometry {
  constructor(private readonly network: NetworkRepository) {}

  async execute(query: Pick<LinesQuery, 'hubCode'> = {}): Promise<TrackFeatureCollection> {
    const lines = await selectLines(this.network, query);
    const perLine = await Promise.all(
      lines.map((line) => this.network.simplifiedTrackGeometryFor(line.code)),
    );
    return {
      type: 'FeatureCollection',
      features: perLine.flat().flatMap((geometry) =>
        geometry.path.length < 2
          ? []
          : [
              {
                type: 'Feature' as const,
                geometry: {
                  type: 'LineString' as const,
                  coordinates: geometry.path.map(([lon, lat]) => [lon, lat] as [number, number]),
                },
                properties: { lineCode: geometry.lineCode, shapeId: geometry.shapeId },
              },
            ],
      ),
    };
  }
}
