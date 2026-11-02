'use client';

import * as RadixPopover from '@radix-ui/react-popover';
import type { ReactNode } from 'react';

/** A thin wrapper over Radix Popover. `trigger` must be a single focusable element. */
export function Popover({
  trigger,
  children,
  align = 'start',
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  /** Set both `open` and `onOpenChange` to control it, e.g. to close it after navigating. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <RadixPopover.Root
      {...(open !== undefined && { open })}
      {...(onOpenChange && { onOpenChange })}
    >
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          sideOffset={8}
          className="z-50 rounded-md bg-surface p-3 text-ink shadow-2 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
