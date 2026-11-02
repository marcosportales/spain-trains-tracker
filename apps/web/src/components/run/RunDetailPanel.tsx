import type { RunDetail, TrainHistory } from '@stt/contracts';
import { useTranslations } from 'next-intl';
import type { StationNames } from '@/lib/station-names';
import { serviceTypeVar } from '@/theme/tokens';
import { BAND_CLASSES, DelayBadge } from '../delay/DelayBadge';
import { ShareButton } from '../share/ShareButton';
import { DetailSurface } from '../ui/DetailSurface';
import { EmptyState } from '../ui/EmptyState';
import { RunCloseButton } from './RunCloseButton';
import { delayBand, showsNoPositionBadge, stopTimes } from './run-detail-view';
import { recentRuns, typicalDelay } from './train-history-view';

/** Run detail on a `DetailSurface`: a side panel on larger screens, a bottom sheet on mobile. */
export function RunDetailPanel({
  detail,
  history,
  names,
}: {
  detail: RunDetail;
  /** Station name for a code (see `stationNames`). */
  names: StationNames;
  /** Delay history of the Train number; leave out when it could not be loaded. */
  history?: TrainHistory | undefined;
}) {
  const t = useTranslations('RunDetail');
  const { run } = detail;
  const band = delayBand(detail);
  const nextStop = detail.position?.nextStationCode;
  const typical = history && typicalDelay(history);

  return (
    <DetailSurface
      label={t('title', { trainNumber: run.trainNumber })}
      actions={
        <>
          <ShareButton title={t('title', { trainNumber: run.trainNumber })} />
          <RunCloseButton />
        </>
      }
      headline={
        <>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <span
              aria-hidden="true"
              className="inline-block size-3 rounded-full"
              style={{ backgroundColor: serviceTypeVar(run.serviceType) }}
            />
            {t(`serviceTypes.${run.serviceType}`)} {run.trainNumber}
            {run.lineCode && <span className="text-sm font-normal">· {run.lineCode}</span>}
          </h1>
          <p className="text-sm font-normal text-ink-2">
            {detail.originStationCode && detail.destinationStationCode
              ? t('route', {
                  origin: names(detail.originStationCode),
                  destination: names(detail.destinationStationCode),
                })
              : null}
          </p>
          {showsNoPositionBadge(detail) ? (
            <p
              data-testid="no-position-badge"
              className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium tabular-nums ${BAND_CLASSES.unknown}`}
            >
              {t('badge.noPosition')}
            </p>
          ) : (
            <div className="mt-2">
              <DelayBadge
                band={band}
                delaySeconds={detail.delaySeconds}
                data-testid="delay-badge"
              />
            </div>
          )}
        </>
      }
    >
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {nextStop && (
          <>
            <dt className="font-semibold">{t('nextStation')}</dt>
            <dd>{names(nextStop)}</dd>
          </>
        )}
        {detail.wheelchairAccessible !== undefined && (
          <>
            <dt className="font-semibold">{t('accessibility')}</dt>
            <dd>{t(detail.wheelchairAccessible ? 'accessible' : 'notAccessible')}</dd>
          </>
        )}
        {detail.rollingStock && (
          <>
            <dt className="font-semibold">{t('rollingStock')}</dt>
            <dd>{detail.rollingStock}</dd>
          </>
        )}
      </dl>

      <h2 className="mt-4 text-sm font-semibold">{t('stops')}</h2>
      {detail.stops.length === 0 ? (
        <EmptyState message={t('noStops')} />
      ) : (
        <ol className="mt-1 space-y-1 text-sm">
          {detail.stops.map((stop) => {
            const times = stopTimes(stop);
            return (
              <li
                key={stop.sequence}
                aria-current={stop.stationCode === nextStop ? 'step' : undefined}
                className={`flex justify-between gap-2 rounded px-2 py-1 ${stop.stationCode === nextStop ? 'bg-gray-100 font-medium' : ''}`}
              >
                <span>{names(stop.stationCode)}</span>
                <span className="tabular-nums">
                  {times.changed ? (
                    <>
                      <s className="text-gray-500">{times.scheduled}</s> {times.estimated}
                    </>
                  ) : (
                    (times.estimated ?? times.scheduled)
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {history && (
        <section data-testid="train-history" aria-labelledby="train-history-title">
          <h2 id="train-history-title" className="mt-4 text-sm font-semibold">
            {t('history')}
          </h2>
          {typical ? (
            <>
              <p className="text-sm">
                {typical.kind === 'on_time'
                  ? t('historyOnTime', { runs: typical.runs })
                  : t('historyLate', {
                      minutes: typical.minutes,
                      runs: typical.runs,
                    })}
              </p>
              <ul className="mt-1 space-y-1 text-sm text-gray-600">
                {recentRuns(history).map((row) => (
                  <li key={row.serviceDate} className="tabular-nums">
                    {t('historyRun', {
                      date: row.serviceDate,
                      minutes: row.minutes,
                      maxMinutes: row.maxMinutes,
                    })}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-gray-600">{t('historyNone')}</p>
          )}
        </section>
      )}
    </DetailSurface>
  );
}
