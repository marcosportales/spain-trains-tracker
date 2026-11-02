'use client';

import type { ServiceType } from '@stt/contracts';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { SERVICE_TYPES, serviceTypeVar } from '@/theme/tokens';
import { HUB_OPTIONS, type MapFilters } from './map-filters';

type Props = {
  filters: MapFilters;
  /** Line codes to offer, e.g. those of the Runs currently live. */
  lineOptions: readonly string[];
  onChange: (next: MapFilters) => void;
};

/** Filter panel: a bottom sheet on mobile, a floating card on larger screens. */
export function FilterPanel({ filters, lineOptions, onChange }: Props) {
  const t = useTranslations('Filters');
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const active = filters.serviceTypes.length + (filters.hub ? 1 : 0) + (filters.line ? 1 : 0);

  const toggleType = (type: ServiceType) =>
    onChange({
      ...filters,
      serviceTypes: filters.serviceTypes.includes(type)
        ? filters.serviceTypes.filter((s) => s !== type)
        : [...filters.serviceTypes, type],
    });

  const lines =
    filters.line && !lineOptions.includes(filters.line)
      ? [filters.line, ...lineOptions]
      : lineOptions;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-2 p-3 md:inset-x-auto md:top-3 md:bottom-auto md:left-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto rounded-full border bg-white px-4 py-2 text-sm font-medium shadow"
      >
        {t('title')}
        {active > 0 && ` (${active})`}
      </button>
      <section
        id={panelId}
        aria-label={t('title')}
        hidden={!open}
        className="pointer-events-auto max-h-[60dvh] w-full space-y-4 overflow-y-auto rounded-t-xl border bg-white p-4 shadow-lg md:w-72 md:rounded-xl"
      >
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold">{t('serviceType')}</legend>
          {SERVICE_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.serviceTypes.includes(type)}
                onChange={() => toggleType(type)}
              />
              <span
                aria-hidden="true"
                className="inline-block size-3 rounded-full"
                style={{ backgroundColor: serviceTypeVar(type) }}
              />
              {t(`serviceTypes.${type}`)}
            </label>
          ))}
        </fieldset>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">{t('hub')}</span>
          <select
            className="w-full rounded border px-2 py-1"
            value={filters.hub ?? ''}
            onChange={(e) => onChange({ ...filters, hub: e.target.value || undefined })}
          >
            <option value="">{t('allHubs')}</option>
            {HUB_OPTIONS.map((hub) => (
              <option key={hub.code} value={hub.code}>
                {hub.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-semibold">{t('line')}</span>
          <select
            className="w-full rounded border px-2 py-1"
            value={filters.line ?? ''}
            onChange={(e) => onChange({ ...filters, line: e.target.value || undefined })}
          >
            <option value="">{t('allLines')}</option>
            {lines.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        </label>

        {active > 0 && (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => onChange({ serviceTypes: [] })}
          >
            {t('clear')}
          </button>
        )}
      </section>
    </div>
  );
}
