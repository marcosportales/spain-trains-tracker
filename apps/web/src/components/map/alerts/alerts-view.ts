import type { ServiceAlertDto } from '@stt/contracts';

/** Every Line affected by at least one alert, once each, sorted. */
export function affectedLineCodes(alerts: readonly ServiceAlertDto[]): string[] {
  return [...new Set(alerts.flatMap((a) => a.lineCodes))].sort();
}

/** "Affects C1 and C5": a sentence naming the Lines an alert touches, in `locale`. */
export function affectsSentence(lineCodes: readonly string[], locale: string): string {
  const lines = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(
    lineCodes,
  );
  return locale.startsWith('es') ? `Afecta a ${lines}` : `Affects ${lines}`;
}

/** Date and time of an alert's start, in Madrid time. */
export function formatAlertTimestamp(timestamp: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Madrid',
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
  }).format(new Date(timestamp));
}
