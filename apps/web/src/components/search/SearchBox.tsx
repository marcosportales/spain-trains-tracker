'use client';

import type { SearchResult } from '@stt/contracts';
import { Search, Signpost } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { fetchSearch } from '@/lib/search-api';
import { serviceTypeVar } from '@/theme/tokens';
import {
  moveActive,
  normaliseQuery,
  optionHref,
  runRouteText,
  SEARCH_DEBOUNCE_MS,
  type SearchOption,
  searchOptions,
} from './search-view';

type Status = 'idle' | 'loading' | 'ready' | 'error';

/** Header combobox: debounced `/search`, grouped results, keyboard navigation (ARIA 1.2 combobox). */
export function SearchBox() {
  const t = useTranslations('Search');
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<SearchResult>();
  const [status, setStatus] = useState<Status>('idle');
  const root = useRef<HTMLDivElement>(null);

  const { query, searchable } = normaliseQuery(text);
  // Only the answer to the current query: a stale one must not be selectable.
  const options = result && searchable && result.query === query ? searchOptions(result) : [];

  useEffect(() => {
    if (!searchable) {
      setStatus('idle');
      setResult(undefined);
      return;
    }
    setStatus('loading');
    setActive(-1);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchSearch(query, undefined, controller.signal).then(
        (found) => {
          setResult(found);
          setActive(-1);
          setStatus('ready');
        },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            console.error(error);
            setResult(undefined);
            setStatus('error');
          }
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchable]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const select = (option: SearchOption) => {
    setOpen(false);
    setText('');
    router.push(optionHref(option));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(moveActive(active, event.key === 'ArrowDown' ? 1 : -1, options.length));
    } else if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault();
      select(options[active]);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'Escape') {
      if (open) event.preventDefault();
      setOpen(false);
    }
  };

  const showPopup = open && searchable;
  const message =
    status === 'error'
      ? t('error')
      : status === 'ready' && options.length === 0
        ? t('noResults')
        : undefined;
  const groups = [
    { kind: 'run', label: t('runs') },
    { kind: 'station', label: t('stations') },
    { kind: 'line', label: t('lines') },
  ] as const;

  return (
    <div ref={root} className="relative w-full max-w-xl">
      <Search
        aria-hidden="true"
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3"
      />
      <input
        type="search"
        role="combobox"
        aria-label={t('label')}
        aria-haspopup="listbox"
        aria-expanded={showPopup}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPopup && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={t('placeholder')}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="min-h-10 w-full rounded-md bg-surface-2 py-1.5 pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-none border border-transparent focus:border-accent focus:ring-1 focus:ring-accent"
      />
      <div role="status" className="sr-only">
        {showPopup &&
          status === 'ready' &&
          options.length > 0 &&
          t('count', { count: options.length })}
        {showPopup && message}
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label={t('label')}
        hidden={!showPopup || options.length === 0}
        className="absolute inset-x-0 top-full z-30 mt-2 max-h-[60dvh] overflow-y-auto rounded-lg bg-surface p-1 text-ink shadow-2"
      >
        {groups.map(({ kind, label }) => {
          const group = options.filter((o) => o.kind === kind);
          if (group.length === 0) return null;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a listbox group must be role=group, not a fieldset
            <div key={kind} role="group" aria-label={label}>
              <div
                aria-hidden="true"
                className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-3 uppercase"
              >
                {label}
              </div>
              {group.map((option) => {
                const index = options.indexOf(option);
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard is handled on the combobox input (aria-activedescendant)
                  <div
                    key={option.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(option)}
                    onMouseMove={() => setActive(index)}
                    className={`cursor-pointer rounded-md px-3 py-1.5 text-sm ${index === active ? 'bg-surface-2' : ''}`}
                  >
                    <OptionLabel option={option} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {showPopup && message && (
        <p className="absolute inset-x-0 top-full z-30 mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink shadow-2">
          {message}
        </p>
      )}
    </div>
  );
}

function OptionLabel({ option }: { option: SearchOption }) {
  const t = useTranslations('Search');
  const types = useTranslations('RunDetail.serviceTypes');
  switch (option.kind) {
    case 'line':
      return (
        <>
          <span className="font-medium">{option.hit.lineCode}</span>{' '}
          {option.hit.name !== option.hit.lineCode && (
            <span className="text-ink-2">{option.hit.name}</span>
          )}
        </>
      );
    case 'station':
      return (
        <span className="flex items-center gap-2">
          <Signpost aria-hidden="true" size={14} className="shrink-0 text-ink-3" />
          <span className="min-w-0 truncate">{option.hit.name}</span>
        </span>
      );
    case 'run': {
      const route = runRouteText(option.hit);
      return (
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: serviceTypeVar(option.hit.serviceType) }}
          />
          <span className="sr-only">{types(option.hit.serviceType)}, </span>
          <span className="shrink-0 font-medium">
            {t('run', { trainNumber: option.hit.trainNumber })}
          </span>
          {route && <span className="ml-auto min-w-0 truncate text-xs text-ink-2">{route}</span>}
        </span>
      );
    }
  }
}
