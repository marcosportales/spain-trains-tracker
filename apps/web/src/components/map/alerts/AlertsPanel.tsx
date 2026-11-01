'use client';

import type { ServiceAlertDto } from '@stt/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { alertLineOptions, alertsForLine, formatAlertTimestamp } from './alerts-view';

type Props = {
  alerts: readonly ServiceAlertDto[];
  /** Line the list is narrowed to. */
  line: string | undefined;
  onLineChange: (line: string | undefined) => void;
};

/**
 * Service alerts list with a count badge, filterable by Line. Alert text is rendered as plain
 * text only (React escapes it), never as HTML.
 */
export function AlertsPanel({ alerts, line, onLineChange }: Props) {
  const t = useTranslations('Alerts');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const shown = alertsForLine(alerts, line);

  return (
    <div className="pointer-events-none absolute top-3 right-14 z-10 flex max-w-[calc(100%-4.5rem)] flex-col items-end gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow"
      >
        {t('title')}
        <span
          role="status"
          aria-label={t('count', { count: alerts.length })}
          className="rounded-full bg-amber-500 px-2 text-xs font-semibold text-white"
        >
          {alerts.length}
        </span>
      </button>
      <section
        id={panelId}
        aria-label={t('title')}
        hidden={!open}
        className="pointer-events-auto max-h-[60dvh] w-80 max-w-full space-y-3 overflow-y-auto rounded-xl border bg-white p-4 shadow-lg"
      >
        <label className="block space-y-1 text-sm">
          <span className="font-semibold">{t('line')}</span>
          <select
            className="w-full rounded border px-2 py-1"
            value={line ?? ''}
            onChange={(e) => onLineChange(e.target.value || undefined)}
          >
            <option value="">{t('allLines')}</option>
            {alertLineOptions(alerts, line).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        {shown.length === 0 ? (
          <p className="text-sm text-gray-600">{t('empty')}</p>
        ) : (
          <ul className="space-y-3">
            {shown.map((alert) => (
              <li
                key={alert.id}
                className="space-y-1 border-t pt-3 text-sm first:border-t-0 first:pt-0"
              >
                <p className="font-semibold">{alert.header}</p>
                {alert.description && <p className="whitespace-pre-line">{alert.description}</p>}
                <p className="text-xs text-gray-600">
                  {t('lines', { lines: alert.lineCodes.join(', ') })}
                </p>
                <p className="text-xs text-gray-600">
                  {t('source')}
                  {alert.activeFrom &&
                    ` · ${t('since', { when: formatAlertTimestamp(alert.activeFrom, locale) })}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
