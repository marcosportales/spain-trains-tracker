'use client';

import type { ServiceAlertDto } from '@stt/contracts';
import { TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Popover } from '@/components/ui/Popover';
import { affectsSentence, formatAlertTimestamp } from './alerts-view';

type Props = {
  alerts: readonly ServiceAlertDto[];
  /** The alert whose Lines are highlighted on the map. */
  highlightedId: string | undefined;
  onHighlight: (id: string | undefined) => void;
};

/**
 * "⚠ 3 avisos" chip opening the list of Service alerts. Tapping an alert highlights its Lines on
 * the map; tapping it again clears the highlight. Alert text is rendered as plain text only
 * (React escapes it), never as HTML. Hidden when there are no alerts.
 */
export function AlertsChip({ alerts, highlightedId, onHighlight }: Props) {
  const t = useTranslations('Alerts');
  const locale = useLocale();
  if (alerts.length === 0) return null;

  return (
    <div className="pointer-events-auto">
      <Popover
        trigger={
          <Button variant="secondary" size="sm" icon={TriangleAlert} className="shadow-2">
            {t('chip', { count: alerts.length })}
          </Button>
        }
      >
        <ul aria-label={t('title')} className="max-h-[60dvh] w-80 max-w-[85vw] overflow-y-auto">
          {alerts.map((alert) => {
            const pressed = alert.id === highlightedId;
            return (
              <li key={alert.id}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => onHighlight(pressed ? undefined : alert.id)}
                  className="block w-full space-y-1 rounded-md p-2 text-left text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent aria-pressed:bg-surface-2"
                >
                  <span className="block font-medium">
                    {affectsSentence(alert.lineCodes, locale)}
                  </span>
                  <span className="block">{alert.header}</span>
                  {alert.description && (
                    <span className="block whitespace-pre-line text-ink-2">
                      {alert.description}
                    </span>
                  )}
                  <span className="block text-xs text-ink-3">
                    {t('source')}
                    {alert.activeFrom &&
                      ` · ${t('since', { when: formatAlertTimestamp(alert.activeFrom, locale) })}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}
