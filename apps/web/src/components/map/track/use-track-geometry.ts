'use client';

import type { TrackFeatureCollection } from '@stt/contracts';
import { useEffect, useMemo, useState } from 'react';
import { fetchTrackGeometry } from '@/lib/lines-api';
import { type TrackPaths, trackPathsByLine } from '../motion/interpolation';

type TrackGeometry = {
  collection: TrackFeatureCollection | undefined;
  /** Track geometry by Line code, for placing Runs along it. */
  paths: ReadonlyMap<string, TrackPaths>;
};

const NONE: ReadonlyMap<string, TrackPaths> = new Map();

/** Track geometry of every Line, fetched once (it only changes with a static import). Empty until loaded or if the request fails. */
export function useTrackGeometry(): TrackGeometry {
  const [collection, setCollection] = useState<TrackFeatureCollection>();
  useEffect(() => {
    const controller = new AbortController();
    fetchTrackGeometry(undefined, controller.signal).then(setCollection, () => {});
    return () => controller.abort();
  }, []);
  const paths = useMemo(() => (collection ? trackPathsByLine(collection) : NONE), [collection]);
  return { collection, paths };
}
