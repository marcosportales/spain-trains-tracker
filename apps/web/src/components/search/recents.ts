import type { SearchOption } from './search-view';

export const RECENTS_KEY = 'stt.search.recents';
/** Most Recents kept and shown. */
export const RECENTS_LIMIT = 4;

const MADRID_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's Service date ("2026-11-03"), in Madrid time. */
export const madridToday = (now: Date): string => MADRID_DATE.format(now);

/** The slice of `Storage` we use, so tests can pass a fake. */
export type RecentsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isString = (value: unknown): value is string => typeof value === 'string';

/** Narrows untrusted JSON to a well-formed option; anything else is dropped. */
function parseOption(value: unknown): SearchOption | undefined {
  if (!isRecord(value) || !isString(value.id) || !isRecord(value.hit)) return undefined;
  const hit = value.hit;
  switch (value.kind) {
    case 'run':
      return isString(hit.trainNumber) && isString(hit.serviceDate) && isString(hit.serviceType)
        ? (value as SearchOption)
        : undefined;
    case 'station':
      return isString(hit.stationCode) && isString(hit.name) ? (value as SearchOption) : undefined;
    case 'line':
      return isString(hit.lineCode) && isString(hit.name) ? (value as SearchOption) : undefined;
    default:
      return undefined;
  }
}

const dedupe = (options: SearchOption[]): SearchOption[] => {
  const seen = new Set<string>();
  return options.filter((o) => !seen.has(o.id) && seen.add(o.id));
};

/** Recents, most recent first. A Run from another Service date than `today` is dropped. A blocked
 * or corrupt store yields none. */
export function loadRecents(storage: RecentsStorage | undefined, today: string): SearchOption[] {
  try {
    const raw = storage?.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupe(
      parsed
        .map(parseOption)
        .filter((o): o is SearchOption => o !== undefined)
        .filter((o) => o.kind !== 'run' || o.hit.serviceDate === today),
    ).slice(0, RECENTS_LIMIT);
  } catch {
    return [];
  }
}

/** Puts `option` on top (no duplicate), keeps at most 4, and returns the new list. A failing write
 * still returns the list, so the panel keeps working for the session. */
export function addRecent(
  storage: RecentsStorage | undefined,
  today: string,
  option: SearchOption,
): SearchOption[] {
  const next = dedupe([option, ...loadRecents(storage, today)]).slice(0, RECENTS_LIMIT);
  try {
    storage?.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Quota or blocked store: Recents are best-effort.
  }
  return next;
}

export function clearRecents(storage: RecentsStorage | undefined): void {
  try {
    storage?.removeItem(RECENTS_KEY);
  } catch {
    // Blocked store: nothing to clear.
  }
}

/** The browser's `localStorage`, or nothing when access is blocked (it can throw). */
export function browserStorage(): RecentsStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
