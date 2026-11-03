import type { StationBoardEntry } from '@stt/contracts';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { serviceTypeVar } from '@/theme/tokens';
import { DelayBadge } from '../delay/DelayBadge';
import { runDetailPath } from '../run/run-detail-view';
import { entryBand, entryTimes, type Tab } from './station-board-view';

/** Departures/arrivals table: Time | Destination (Origin) | Train | Status. One link per row. */
export function BoardTable({
  entries,
  tab,
  names,
}: {
  entries: readonly StationBoardEntry[];
  tab: Tab;
  names: (code: string) => string;
}) {
  const t = useTranslations('StationBoard');
  const th = 'px-3 py-2 text-left text-xs font-medium text-ink-2';
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={`${th} w-24`}>
            {t('columns.time')}
          </th>
          <th scope="col" className={th}>
            {t(tab === 'departures' ? 'columns.destination' : 'columns.origin')}
          </th>
          <th scope="col" className={`${th} w-32`}>
            {t('columns.train')}
          </th>
          <th scope="col" className={`${th} w-32`}>
            {t('columns.status')}
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const times = entryTimes(entry);
          const station = names(entry.counterpartStationCode);
          return (
            <tr
              key={`${entry.serviceDate}/${entry.trainNumber}`}
              className="relative h-11 border-b border-line hover:bg-surface-2"
            >
              <td className="px-3 py-2 tabular-nums">
                {times.changed ? (
                  <>
                    <s className="text-ink-3">{times.scheduled}</s>{' '}
                    <span className="font-semibold text-ink">{times.estimated}</span>
                  </>
                ) : (
                  times.scheduled
                )}
              </td>
              <td className="truncate px-3 py-2" title={station}>
                {station}
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: serviceTypeVar(entry.serviceType) }}
                  />
                  <Link
                    href={runDetailPath(entry)}
                    className="truncate after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {t('train', { trainNumber: entry.trainNumber })}
                  </Link>
                  {entry.lineCode && (
                    <span className="shrink-0 rounded-sm bg-surface-2 px-1.5 text-xs">
                      {entry.lineCode}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2">
                <DelayBadge
                  band={entryBand(entry)}
                  delaySeconds={entry.delaySeconds}
                  size="sm"
                  data-testid="delay-badge"
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
