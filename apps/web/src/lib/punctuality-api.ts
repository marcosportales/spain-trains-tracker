import type { DelayByHour, PunctualityRanking } from '@stt/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getJson<T>(url: string, what: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${what} request failed: ${res.status}`);
  return (await res.json()) as T;
}

/** Lines ranked by punctuality over the last `days` days. Payload shape is in `@stt/contracts`. */
export function fetchPunctualityRanking(
  days: number,
  baseUrl = API_URL,
): Promise<PunctualityRanking> {
  return getJson(`${baseUrl}/stats/punctuality?days=${days}`, 'Punctuality ranking');
}

/** Delay by hour of day over the last `days` days, for one Line or for all of them. */
export function fetchDelayByHour(
  query: { days: number; lineCode?: string },
  baseUrl = API_URL,
): Promise<DelayByHour> {
  const line = query.lineCode !== undefined ? `&line=${encodeURIComponent(query.lineCode)}` : '';
  return getJson(`${baseUrl}/stats/delay-by-hour?days=${query.days}${line}`, 'Delay by hour');
}
