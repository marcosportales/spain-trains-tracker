import type { SearchResult, SearchSuggestions } from '@stt/contracts';

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

/** The tracked Runs with the biggest Delay, offered before anything is typed. */
export async function fetchSuggestions(
  baseUrl = API_URL,
  signal?: AbortSignal,
): Promise<SearchSuggestions> {
  const res = await fetch(`${baseUrl}/search/suggestions`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Search suggestions request failed: ${res.status}`);
  return (await res.json()) as SearchSuggestions;
}
