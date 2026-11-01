import type { StationBoard } from '@stt/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Station board from the API, or `undefined` when there is no such Station (404, or 400 for a
 * malformed code). Other failures throw. The payload is our own API's (shape in `@stt/contracts`).
 */
export async function fetchStationBoard(
  code: string,
  baseUrl = API_URL,
): Promise<StationBoard | undefined> {
  const res = await fetch(`${baseUrl}/stations/${encodeURIComponent(code)}/board`, {
    cache: 'no-store',
  });
  if (res.status === 404 || res.status === 400) return undefined;
  if (!res.ok) throw new Error(`Station board request failed: ${res.status}`);
  return (await res.json()) as StationBoard;
}
