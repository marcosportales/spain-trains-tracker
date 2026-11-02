'use client';

import type { ServiceType } from '@stt/contracts';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Popover } from '@/components/ui/Popover';
import { Skeleton } from '@/components/ui/Skeleton';
import { SERVICE_TYPES, serviceTypeVar } from '@/theme/tokens';
import type { MapFilters } from '../filters/map-filters';
import { toggleServiceType } from './legend-view';

type Props = {
  filters: MapFilters;
  counts: Record<ServiceType, number>;
  onChange: (next: MapFilters) => void;
  /** No snapshot yet: show placeholders shaped like the buttons instead of zero counts. */
  loading?: boolean;
};

const isShown = (filters: MapFilters, type: ServiceType) =>
  filters.serviceTypes.length === 0 || filters.serviceTypes.includes(type);

function Ring({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-3 rounded-full border-2 align-middle ${className}`}
    />
  );
}

/** Explains the Delay rings drawn around late Runs. */
function RingsKey() {
  const t = useTranslations('Legend');
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-2">
      <Ring className="border-band-late" />
      <span>{t('late')}</span>
      <span aria-hidden="true">·</span>
      <Ring className="border-band-severely-late" />
      <span>{t('severelyLate')}</span>
    </p>
  );
}

/** Service types with live counts; each button shows or hides that type's dots. */
export function Legend({ filters, counts, onChange, loading = false }: Props) {
  const t = useTranslations('Legend');

  return (
    <div className="pointer-events-auto min-w-0 max-w-full rounded-lg bg-surface text-ink shadow-2">
      <div className="flex items-center gap-1 p-1 md:flex-col md:items-stretch">
        <ul className="flex min-w-0 gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {SERVICE_TYPES.map((type) => {
            if (loading) {
              return (
                <li key={type} className="shrink-0">
                  <Skeleton className="h-11 w-32 md:w-full md:min-w-44" />
                </li>
              );
            }
            const shown = isShown(filters, type);
            return (
              <li key={type} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={shown}
                  aria-label={t('typeCount', { type: t(`types.${type}`), count: counts[type] })}
                  onClick={() => onChange(toggleServiceType(filters, type))}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent aria-pressed:font-medium aria-[pressed=false]:text-ink-3"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block size-3 rounded-full ${shown ? '' : 'opacity-40'}`}
                    style={{ backgroundColor: serviceTypeVar(type) }}
                  />
                  <span aria-hidden="true">{t(`types.${type}`)}</span>
                  <span aria-hidden="true" className="ml-auto pl-2 tabular-nums text-ink-2">
                    {counts[type]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="shrink-0 md:hidden">
          <Popover
            align="end"
            trigger={
              <button
                type="button"
                aria-label={t('ringsInfo')}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Info aria-hidden="true" size={18} />
              </button>
            }
          >
            <RingsKey />
          </Popover>
        </div>
      </div>
      <div className="hidden border-t border-surface-2 px-3 py-2 md:block">
        <RingsKey />
      </div>
    </div>
  );
}
