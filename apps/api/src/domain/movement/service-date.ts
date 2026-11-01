import { InvalidMovementValueError } from './errors.js';

/** Renfe's timetables are written in Madrid local time. */
export const SERVICE_TIME_ZONE = 'Europe/Madrid';

/** Runs seen before this local hour may still belong to the previous Service date. */
export const SERVICE_DAY_STARTS_AT_HOUR = 4;

/** What the timetable says about a Run, used to decide which Service date an instant belongs to. */
export interface ServiceSchedule {
  /** True when the Run is scheduled to operate on `serviceDate` (`YYYY-MM-DD`). */
  operatesOn(serviceDate: string): boolean;
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SERVICE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/**
 * The Service date a Run seen at `at` belongs to. Before 04:00 Madrid time the instant is the
 * tail of the previous day's service (a Run scheduled past midnight, as GTFS writes `24:30:00`),
 * but only when the schedule says the Run operates on the previous date; without a schedule the
 * calendar date is used.
 */
export function serviceDateFor(at: Date, schedule?: ServiceSchedule): string {
  if (Number.isNaN(at.getTime())) throw new InvalidMovementValueError('Invalid instant');
  const parts = Object.fromEntries(formatter.formatToParts(at).map((p) => [p.type, p.value]));
  const calendarDate = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) >= SERVICE_DAY_STARTS_AT_HOUR) return calendarDate;

  const previous = new Date(`${calendarDate}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const previousDate = previous.toISOString().slice(0, 10);
  return schedule?.operatesOn(previousDate) ? previousDate : calendarDate;
}
