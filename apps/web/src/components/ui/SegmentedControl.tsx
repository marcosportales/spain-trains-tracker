'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useId, useRef } from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  /** Visible content. */
  label: ReactNode;
  /** The accessible name, when `label` is only an icon. */
  ariaLabel?: string;
};

/** A radio group drawn as a track with one raised, selected option. Arrow keys move the selection. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex gap-0.5 rounded-md bg-surface-3 p-0.5"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a styled segment, not a native radio input; arrow keys are handled below
          <button
            key={option.value}
            id={`${id}-${option.value}`}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-sm px-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
              selected ? 'bg-surface text-ink shadow-1' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
