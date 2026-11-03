'use client';

import type { StationList } from '@stt/contracts';
import { useEffect, useState } from 'react';
import { fetchStations } from '@/lib/stations-api';

const NONE: StationList = [];

/** Every Station, fetched once (the network only changes with a static import). Empty until loaded or if the request fails. */
export function useStations(): StationList {
  const [stations, setStations] = useState<StationList>(NONE);
  useEffect(() => {
    const controller = new AbortController();
    fetchStations({ signal: controller.signal }).then(setStations, () => {});
    return () => controller.abort();
  }, []);
  return stations;
}
