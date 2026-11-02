import type { TrainHistory } from '@stt/contracts';
import { useLocale, useTranslations } from 'next-intl';
import type { DelayBand } from '../delay/delay-band';
import { BAR_MAX_PX, formatServiceDate, historyBars } from './train-history-view';

/** Written out so Tailwind finds them. */
const BAR_CLASSES: Record<DelayBand, string> = {
  on_time: 'bg-band-on-time',
  late: 'bg-band-late',
  severely_late: 'bg-band-severely-late',
  cancelled: 'bg-band-cancelled',
  unknown: 'bg-band-unknown',
};

/** One bar per recent Run, oldest left: how late the train ran, coloured by Delay band. */
export function HistoryBars({ history }: { history: TrainHistory }) {
  const t = useTranslations('RunDetail');
  const locale = useLocale();
  const bars = historyBars(history);
  return (
    <div className="mt-2">
      <ul className="flex items-end gap-0.5" style={{ height: BAR_MAX_PX }}>
        {bars.map((bar) => {
          const text = t('historyBar', {
            date: formatServiceDate(bar.serviceDate, locale),
            minutes: bar.minutes,
            maxMinutes: bar.maxMinutes,
          });
          return (
            <li
              key={bar.serviceDate}
              title={text}
              className={`w-5 rounded-t-[4px] ${BAR_CLASSES[bar.band]}`}
              style={{ height: bar.heightPx }}
            >
              <span className="sr-only">{text}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-xs text-ink-3">{t('historyRuns', { n: bars.length })}</p>
    </div>
  );
}
