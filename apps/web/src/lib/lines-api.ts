import type { TrackFeatureCollection } from '@stt/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Track geometry of every Line. The payload is our own API's (shape in `@stt/contracts`). */
export async function fetchTrackGeometry(
  baseUrl = API_URL,
  signal?: AbortSignal,
): Promise<TrackFeatureCollection> {
  const res = await fetch(`${baseUrl}/lines/geometry`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Track geometry request failed: ${res.status}`);
  return (await res.json()) as TrackFeatureCollection;
}
