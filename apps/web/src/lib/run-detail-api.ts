import type { RunDetail, RunId } from '@stt/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Run detail from the API, or `undefined` when there is no such Run (404, or 400 for malformed
 * params). Other failures throw. The payload is our own API's (shape in `@stt/contracts`).
 */
export async function fetchRunDetail(id: RunId, baseUrl = API_URL): Promise<RunDetail | undefined> {
  const res = await fetch(`${baseUrl}/runs/${id.serviceDate}/${id.trainNumber}`, {
    cache: 'no-store',
  });
  if (res.status === 404 || res.status === 400) return undefined;
  if (!res.ok) throw new Error(`Run detail request failed: ${res.status}`);
  return (await res.json()) as RunDetail;
}
