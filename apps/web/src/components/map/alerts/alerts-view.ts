import type { ServiceAlertDto } from '@stt/contracts';

/** Alerts affecting `line`, or all of them when no Line is selected. */
export function alertsForLine(
  alerts: readonly ServiceAlertDto[],
  line: string | undefined,
): ServiceAlertDto[] {
  return line === undefined ? [...alerts] : alerts.filter((a) => a.lineCodes.includes(line));
}

/** Every Line affected by at least one alert, once each, sorted. */
export function affectedLineCodes(alerts: readonly ServiceAlertDto[]): string[] {
  return [...new Set(alerts.flatMap((a) => a.lineCodes))].sort();
}

/** Lines the alerts filter offers; the selected one stays even if no alert affects it. */
export function alertLineOptions(
  alerts: readonly ServiceAlertDto[],
  selected: string | undefined,
): string[] {
  const lines = affectedLineCodes(alerts);
  return selected !== undefined && !lines.includes(selected) ? [selected, ...lines] : lines;
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
