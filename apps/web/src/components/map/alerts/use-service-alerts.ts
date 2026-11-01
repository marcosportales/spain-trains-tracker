'use client';

import type { ServiceAlertDto } from '@stt/contracts';
import { useEffect, useState } from 'react';
import { fetchActiveAlerts } from '@/lib/alerts-api';

export const ALERTS_REFRESH_MS = 60_000;

/** Active Service alerts, refreshed every minute. Keeps the last known list if a refresh fails. */
export function useServiceAlerts(): ServiceAlertDto[] {
  const [alerts, setAlerts] = useState<ServiceAlertDto[]>([]);
  useEffect(() => {
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      fetchActiveAlerts(undefined, controller.signal).then(setAlerts, () => {});
    };
    load();
    const timer = setInterval(load, ALERTS_REFRESH_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);
  return alerts;
}
