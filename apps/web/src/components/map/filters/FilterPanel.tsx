'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { HUB_OPTIONS, type MapFilters } from './map-filters';

type Props = {
  filters: MapFilters;
  /** Line codes to offer, e.g. those of the Runs currently live. */
  lineOptions: readonly string[];
  onChange: (next: MapFilters) => void;
};

/** `Select` options must be non-empty, so "no filter" gets a sentinel value. */
const ALL = '__all__';

/** Hub and Line filters. Service types live in the Legend. */
export function FilterPanel({ filters, lineOptions, onChange }: Props) {
  const t = useTranslations('Filters');
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const active = (filters.hub ? 1 : 0) + (filters.line ? 1 : 0);

  const lines =
    filters.line && !lineOptions.includes(filters.line)
      ? [filters.line, ...lineOptions]
      : lineOptions;

  return (
    <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col items-start gap-2">
      <Button
        variant="secondary"
        icon={SlidersHorizontal}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto shadow-2"
      >
        {t('title')}
        {active > 0 && ` (${active})`}
      </Button>
      <section
        id={panelId}
        aria-label={t('title')}
        hidden={!open}
        className="pointer-events-auto max-h-[60dvh] w-72 max-w-[calc(100vw-1.5rem)] space-y-4 overflow-y-auto rounded-lg bg-surface p-4 text-ink shadow-2"
      >
        <Select
          label={t('hub')}
          value={filters.hub ?? ALL}
          onValueChange={(value) =>
            onChange({ ...filters, hub: value === ALL ? undefined : value })
          }
          options={[
            { value: ALL, label: t('allHubs') },
            ...HUB_OPTIONS.map((hub) => ({ value: hub.code, label: hub.name })),
          ]}
        />
        <Select
          label={t('line')}
          value={filters.line ?? ALL}
          onValueChange={(value) =>
            onChange({ ...filters, line: value === ALL ? undefined : value })
          }
          options={[
            { value: ALL, label: t('allLines') },
            ...lines.map((line) => ({ value: line, label: line })),
          ]}
        />
        {active > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ serviceTypes: filters.serviceTypes })}
          >
            {t('clear')}
          </Button>
        )}
      </section>
    </div>
  );
}
