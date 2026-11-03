import type { StationList } from '@stt/contracts';

/** Name of the Station with a code; the code itself when the Station is unknown (never blank). */
export type StationNames = (code: string) => string;

export function stationNames(list: StationList): StationNames {
  const byCode = new Map(list.map((station) => [station.code, station.name]));
  return (code) => byCode.get(code) ?? code;
}
