import type { StationBoardEntry } from '@stt/contracts';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { serviceTypeVar } from '@/theme/tokens';
import { DelayBadge } from '../delay/DelayBadge';
import { runDetailPath } from '../run/run-detail-view';
import { entryBand, entryTimes, type Tab } from './station-board-view';

/**
 * Departures/arrivals table: Time | Destination (Origin) | Train | Status. One link per row.
 * The fixed columns stay narrow so the station name keeps most of the 400 px side panel.
 */
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
  const cell = 'px-2 py-2';
  const th = `${cell} truncate text-left text-xs font-medium text-ink-2`;
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={`${th} w-16`}>
            {t('columns.time')}
          </th>
          <th scope="col" className={th}>
            {t(tab === 'departures' ? 'columns.destination' : 'columns.origin')}
          </th>
          <th scope="col" className={`${th} w-20`}>
            {t('columns.train')}
          </th>
          <th scope="col" className={`${th} w-28`}>
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
              key={`${entry.serviceDate}/${entry.trainNumber}/${entry.scheduledAt}/${entry.counterpartStationCode}`}
              className="relative h-11 border-b border-line hover:bg-surface-2"
            >
              <td className={`${cell} tabular-nums`}>
                {times.changed ? (
                  <>
                    <s className="text-ink-3">{times.scheduled}</s>{' '}
                    <span className="font-semibold text-ink">{times.estimated}</span>
                  </>
                ) : (
                  times.scheduled
                )}
              </td>
              <td className={`${cell} truncate`} title={station}>
                {station}
              </td>
              <td className={cell}>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="inline-block size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: serviceTypeVar(entry.serviceType) }}
                  />
                  <Link
                    href={runDetailPath(entry)}
                    aria-label={t('train', { trainNumber: entry.trainNumber })}
                    className="truncate tabular-nums after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {entry.trainNumber}
                  </Link>
                </span>
                {entry.lineCode && (
                  <span
                    title={entry.lineCode}
                    className="mt-0.5 inline-block max-w-full truncate rounded-sm bg-surface-2 px-1.5 text-xs"
                  >
                    {entry.lineCode}
                  </span>
                )}
              </td>
              <td className={cell}>
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
