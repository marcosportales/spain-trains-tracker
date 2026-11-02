'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { useIsDesktop } from './use-media-query';

/** Mobile top bar height, and the gap left under it when the sheet is fully open. */
const TOP_BAR_PX = 48;
const FULL_GAP_PX = TOP_BAR_PX + 8;
const PEEK = '150px';
const HALF = 0.42;

type Props = {
  /** The accessible name: the desktop `<aside>`'s label, the mobile drawer's title. */
  label: string;
  /** The one-sentence answer. It is all that shows at the peek snap point. */
  headline: ReactNode;
  children: ReactNode;
  /** Top-right controls: share, close. */
  actions?: ReactNode;
};

/**
 * The container for Run detail and the Station board: a side panel from `md` up, a non-modal
 * `vaul` bottom sheet below it (peek, half, full; opens at half; cannot be dismissed by dragging).
 */
export function DetailSurface(props: Props) {
  return useIsDesktop() ? <SidePanel {...props} /> : <BottomSheet {...props} />;
}

function SidePanel({ label, headline, children, actions }: Props) {
  return (
    <aside
      aria-label={label}
      className="absolute top-below-bar right-3 bottom-3 z-10 flex w-[400px] flex-col overflow-hidden rounded-lg bg-surface text-ink shadow-2"
    >
      <div className="flex items-start gap-2 p-4 pb-2">
        <div className="min-w-0 flex-1 text-xl font-semibold">{headline}</div>
        {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-2">{children}</div>
    </aside>
  );
}

function BottomSheet({ label, headline, children, actions }: Props) {
  // `full` is a fraction of the viewport, so it needs the viewport height; start from a safe guess.
  const [full, setFull] = useState(0.9);
  useEffect(() => {
    const update = () => setFull((window.innerHeight - FULL_GAP_PX) / window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const snapPoints = [PEEK, HALF, full];
  const [active, setActive] = useState<number | string | null>(HALF);
  const peeking = active === PEEK;

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      snapPoints={snapPoints}
      activeSnapPoint={active}
      setActiveSnapPoint={setActive}
      fadeFromIndex={snapPoints.length}
    >
      <Drawer.Portal>
        <Drawer.Content
          aria-describedby={undefined}
          style={{ height: '100dvh' }}
          className="fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-xl bg-surface text-ink shadow-2 outline-none"
        >
          <Drawer.Handle className="mt-2 mb-1 bg-ink-3" />
          <Drawer.Title className="sr-only">{label}</Drawer.Title>
          <div className="flex items-start gap-2 px-4 pt-1 pb-2">
            <div className="min-w-0 flex-1 text-xl font-semibold">{headline}</div>
            {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
          </div>
          {!peeking && <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
