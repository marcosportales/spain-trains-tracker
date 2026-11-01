import type { StationSummary } from '@stt/contracts';
import type { NetworkRepository } from '../network/network.repository.js';

/** Every Station with its position, ordered by code. */
export class ListStations {
  constructor(private readonly network: NetworkRepository) {}

  async execute(): Promise<StationSummary[]> {
    const stations = await this.network.listStations();
    return stations.map(({ code, name, lat, lon }) => ({ code, name, lat, lon }));
  }
}
