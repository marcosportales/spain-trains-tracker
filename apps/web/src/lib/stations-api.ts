import type { StationList } from '@stt/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface FetchStationsOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  /** Seconds the Next.js server may cache the response (server-side callers only). */
  revalidate?: number;
}

/** Every Station with its position. The payload is our own API's (shape in `@stt/contracts`). */
export async function fetchStations({
  baseUrl = API_URL,
  signal,
  revalidate,
}: FetchStationsOptions = {}): Promise<StationList> {
  const init = {
    ...(signal && { signal }),
    ...(revalidate !== undefined && { next: { revalidate } }),
  };
  const res = await fetch(`${baseUrl}/stations`, Object.keys(init).length ? init : undefined);
  if (!res.ok) throw new Error(`Stations request failed: ${res.status}`);
  return (await res.json()) as StationList;
}
