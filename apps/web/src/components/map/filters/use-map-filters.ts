'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { filtersToSearch, type MapFilters, parseFilters } from './map-filters';

/** Map filters backed by the URL search params, so reload and shared links keep them. */
export function useMapFilters(): [MapFilters, (next: MapFilters) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = searchParams.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(key)), [key]);

  const setFilters = useCallback(
    (next: MapFilters) => {
      const search = filtersToSearch(next);
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return [filters, setFilters];
}
