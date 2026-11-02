import type { RunDetail, TrainHistory } from '@stt/contracts';
import { useTranslations } from 'next-intl';
import type { StationNames } from '@/lib/station-names';
import { serviceTypeVar } from '@/theme/tokens';
import { DelayBadge } from '../delay/DelayBadge';
import { ShareButton } from '../share/ShareButton';
import { DetailSurface } from '../ui/DetailSurface';
import { HistoryBars } from './HistoryBars';
import { RunChips } from './RunChips';
import { RunCloseButton } from './RunCloseButton';
import { RunTimeline } from './RunTimeline';
import { delayBand, type RunHeadline, runHeadline } from './run-detail-view';
import { typicalDelay } from './train-history-view';

type Translate = ReturnType<typeof useTranslations<'RunDetail'>>;

/** The headline sentence: the status, then "· next stop …" when the next stop is known. */
function headlineText(t: Translate, headline: RunHeadline): string {
  switch (headline.kind) {
    case 'cancelled':
      return t('headline.cancelled');
    case 'not_departed':
      return headline.time
        ? t('headline.notDeparted', { origin: headline.origin, time: headline.time })
        : t('headline.notDepartedNoTime', { origin: headline.origin });
    case 'running': {
      const status =
        headline.band === 'on_time'
          ? t('headline.onTime')
          : headline.band === 'unknown'
            ? t('headline.unknown')
            : t('headline.late', { minutes: headline.minutes ?? 0 });
      const { nextStop } = headline;
      if (!nextStop) return status;
      const next = nextStop.time
        ? t('headline.nextStop', { station: nextStop.station, time: nextStop.time })
        : t('headline.nextStopNoTime', { station: nextStop.station });
      return `${status} · ${next}`;
    }
  }
}

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
  const headline = runHeadline(detail, names);
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
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1
              data-testid="run-headline"
              className="text-[20px] leading-tight font-semibold tabular-nums md:text-[22px]"
            >
              {headlineText(t, headline)}
            </h1>
            {headline.kind !== 'not_departed' && (
              <DelayBadge
                band={band}
                delaySeconds={detail.delaySeconds}
                data-testid="delay-badge"
              />
            )}
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm font-normal text-ink-2">
            <span
              aria-hidden="true"
              className="inline-block size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: serviceTypeVar(run.serviceType) }}
            />
            {[
              t(`serviceTypes.${run.serviceType}`),
              run.lineCode,
              detail.originStationCode &&
                detail.destinationStationCode &&
                t('route', {
                  origin: names(detail.originStationCode),
                  destination: names(detail.destinationStationCode),
                }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      }
    >
      <RunChips
        wheelchairAccessible={detail.wheelchairAccessible}
        rollingStock={detail.rollingStock}
      />

      <h2 className="mt-4 text-sm font-semibold">{t('stops')}</h2>
      <RunTimeline detail={detail} names={names} />

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
              <HistoryBars history={history} />
            </>
          ) : (
            <p className="text-sm text-ink-2">{t('historyNone')}</p>
          )}
        </section>
      )}
    </DetailSurface>
  );
}
