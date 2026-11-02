'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useId } from 'react';

export type SelectOption = { value: string; label: string };

/** A thin wrapper over Radix Select with a visible label. Option values must be non-empty. */
export function Select({
  label,
  options,
  value,
  onValueChange,
  placeholder,
}: {
  label: string;
  options: readonly SelectOption[];
  value?: string | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-xs font-medium text-ink-2">
        {label}
      </span>
      <RadixSelect.Root value={value} onValueChange={onValueChange}>
        <RadixSelect.Trigger
          aria-labelledby={labelId}
          className="inline-flex min-h-11 items-center justify-between gap-2 rounded-md bg-surface-2 px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown aria-hidden="true" size={16} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="z-50 max-h-80 min-w-(--radix-select-trigger-width) overflow-hidden rounded-md bg-surface text-ink shadow-2"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className="flex min-h-11 cursor-default items-center justify-between gap-3 rounded-sm px-3 text-base outline-none data-[highlighted]:bg-surface-2 data-[state=checked]:bg-accent-soft"
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator>
                    <Check aria-hidden="true" size={16} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}
