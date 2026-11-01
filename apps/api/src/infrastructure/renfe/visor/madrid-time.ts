import { SERVICE_TIME_ZONE } from '../../../domain/movement/index.js';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SERVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Milliseconds Madrid local time is ahead of UTC at the instant `at`. */
function madridOffsetMs(at: number): number {
  const p = Object.fromEntries(formatter.formatToParts(at).map((part) => [part.type, part.value]));
  const local = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return local - Math.floor(at / 1000) * 1000;
}

/**
 * The instant at which Madrid's wall clock read `serviceDate` (`YYYY-MM-DD`) plus `dayOffset` days,
 * `hour:minute:second`. Visor times carry no time zone; they are Madrid local time.
 */
export function madridLocalToDate(
  serviceDate: string,
  hour: number,
  minute: number,
  second = 0,
  dayOffset = 0,
): Date {
  const [year, month, day] = serviceDate.split('-').map(Number) as [number, number, number];
  const wallClock = Date.UTC(year, month - 1, day + dayOffset, hour, minute, second);
  const first = wallClock - madridOffsetMs(wallClock);
  const second_ = wallClock - madridOffsetMs(first);
  return new Date(second_);
}

/** Parses a visor timestamp such as `2026-10-31T23:35:12` (Madrid local time). */
export function parseMadridLocalTimestamp(value: string): Date | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const [, date, h, m, s] = match as unknown as [string, string, string, string, string];
  const parsed = madridLocalToDate(date, Number(h), Number(m), Number(s));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
