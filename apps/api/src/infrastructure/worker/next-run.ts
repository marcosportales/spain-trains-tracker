const MADRID = 'Europe/Madrid';

/** The Madrid wall-clock fields of an instant. */
function madridParts(date: Date): { year: number; month: number; day: number; offsetMs: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MADRID,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    offsetMs: asUtc - Math.floor(date.getTime() / 1000) * 1000,
  };
}

/** The next instant after `after` at which the clock in Madrid reads `hour:minute`. */
export function nextMadridTime(after: Date, hour: number, minute: number): Date {
  const today = madridParts(after);
  for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
    const wall = Date.UTC(today.year, today.month - 1, today.day + dayOffset, hour, minute);
    // The offset can differ between the guess and the result around a clock change: resolve twice.
    let candidate = wall - madridParts(new Date(wall)).offsetMs;
    candidate = wall - madridParts(new Date(candidate)).offsetMs;
    if (candidate > after.getTime()) return new Date(candidate);
  }
  throw new Error('unreachable: no 03:30 within three days');
}
