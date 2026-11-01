import type { ServiceAlertDto } from '@stt/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Service alerts in force now. The payload is our own API's (shape in `@stt/contracts`). */
export async function fetchActiveAlerts(
  baseUrl = API_URL,
  signal?: AbortSignal,
): Promise<ServiceAlertDto[]> {
  const res = await fetch(`${baseUrl}/alerts?active=true`, signal ? { signal } : undefined);
  if (!res.ok) throw new Error(`Alerts request failed: ${res.status}`);
  return (await res.json()) as ServiceAlertDto[];
}
