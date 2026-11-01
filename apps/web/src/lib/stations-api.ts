import type { StationList } from '@stt/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Every Station with its position. The payload is our own API's (shape in `@stt/contracts`). */
export async function fetchStations(baseUrl = API_URL, signal?: AbortSignal): Promise<StationList> {
  const res = await fetch(`${baseUrl}/stations`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Stations request failed: ${res.status}`);
  return (await res.json()) as StationList;
}
