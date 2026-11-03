import { Accessibility, type LucideIcon, TrainFront } from 'lucide-react';
import { useTranslations } from 'next-intl';

function Chip({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <li className="inline-flex items-center gap-2 rounded-sm bg-surface-2 px-2 py-1 text-[13px] text-ink">
      <Icon aria-hidden="true" size={14} className="shrink-0 text-ink-2" />
      {text}
    </li>
  );
}

/** Small facts about the train, each shown only when known. */
export function RunChips({
  wheelchairAccessible,
  rollingStock,
}: {
  wheelchairAccessible?: boolean | undefined;
  rollingStock?: string | undefined;
}) {
  const t = useTranslations('RunDetail');
  if (wheelchairAccessible === undefined && !rollingStock) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {wheelchairAccessible !== undefined && (
        <Chip
          icon={Accessibility}
          text={t(wheelchairAccessible ? 'accessible' : 'notAccessible')}
        />
      )}
      {rollingStock && <Chip icon={TrainFront} text={t('rollingStock', { rollingStock })} />}
    </ul>
  );
}
