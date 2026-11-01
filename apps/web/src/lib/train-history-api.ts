import type { TrainHistory } from '@stt/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Delay history of a Train number over the last `days` days, or `undefined` when it cannot be
 * had (history is a nice-to-have next to the Run, so failures must not break the page).
 * The payload is our own API's (shape in `@stt/contracts`).
 */
export async function fetchTrainHistory(
  trainNumber: string,
  days = 30,
  baseUrl = API_URL,
): Promise<TrainHistory | undefined> {
  try {
    const res = await fetch(
      `${baseUrl}/trains/${encodeURIComponent(trainNumber)}/history?days=${days}`,
      {
        cache: 'no-store',
      },
    );
    if (!res.ok) return undefined;
    return (await res.json()) as TrainHistory;
  } catch {
    return undefined;
  }
}
