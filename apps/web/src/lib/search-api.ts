import type { SearchResult } from '@stt/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Runs, Stations and Lines matching `query`. The payload is our own API's (shape in `@stt/contracts`). */
export async function fetchSearch(
  query: string,
  baseUrl = API_URL,
  signal?: AbortSignal,
): Promise<SearchResult> {
  const params = new URLSearchParams({ q: query });
  const res = await fetch(`${baseUrl}/search?${params}`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Search request failed: ${res.status}`);
  return (await res.json()) as SearchResult;
}
