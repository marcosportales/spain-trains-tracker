// @vitest-environment jsdom
import type { DelayByHour, PunctualityRanking } from '@stt/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import messages from '../../../messages/en.json';
import { PunctualityView } from './PunctualityView';

const fetchRanking = vi.fn();
const fetchByHour = vi.fn();
vi.mock('@/lib/punctuality-api', () => ({
  fetchPunctualityRanking: (...args: unknown[]) => fetchRanking(...args),
  fetchDelayByHour: (...args: unknown[]) => fetchByHour(...args),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ranking = (days: number): PunctualityRanking => ({
  days,
  overall: { runs: 10, onTimePct: 90 },
  lines: [],
});
const byHour = (): DelayByHour => ({ days: 30, hours: [] }) as unknown as DelayByHour;

describe('PunctualityView window selector', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    fetchRanking.mockImplementation(async (days: number) => ranking(days));
    fetchByHour.mockImplementation(async () => byHour());
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('is a radiogroup labelled with the window, and the arrow keys refetch', async () => {
    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PunctualityView
            initial={{ ranking: ranking(30), byHour: { ...byHour(), days: 30 } as DelayByHour }}
          />
        </NextIntlClientProvider>,
      );
    });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('Time window');
    const radios = [...container.querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual(['7 days', '30 days', '90 days']);
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');

    await act(async () => {
      radios[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(fetchRanking).toHaveBeenCalledWith(90);
    expect(container.querySelectorAll('[role="radio"]')[2]?.getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  const render = async (initial: { ranking: PunctualityRanking; byHour: DelayByHour }) => {
    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <PunctualityView initial={initial} />
        </NextIntlClientProvider>,
      );
    });
  };

  it('offers a wider window when the ranking is empty, and none at 90 days', async () => {
    await render({ ranking: ranking(7), byHour: { ...byHour(), days: 7 } as DelayByHour });
    expect(container.textContent).toContain('No Lines have enough data yet in 7 days');
    const action = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'See 30 days',
    );
    await act(async () => action?.click());
    expect(fetchRanking).toHaveBeenCalledWith(30);

    act(() => root.unmount());
    root = createRoot(container);
    await render({ ranking: ranking(90), byHour: { ...byHour(), days: 90 } as DelayByHour });
    expect(container.textContent).toContain('No Lines have enough data yet in 90 days');
    expect(container.textContent).not.toContain('See ');
  });

  it('shows skeletons while loading, then a retryable error that keeps the last data', async () => {
    let reject: (e: Error) => void = () => {};
    fetchRanking.mockImplementationOnce(() => new Promise((_, r) => (reject = r)));
    await render({ ranking: ranking(30), byHour: { ...byHour(), days: 30 } as DelayByHour });
    const radios = container.querySelectorAll<HTMLElement>('[role="radio"]');
    await act(async () => radios[2]?.click());
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBe(2);

    await act(async () => reject(new Error('down')));
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toMatch(/Could not load the data · last data from/);
    expect(container.querySelectorAll('[aria-busy="true"]').length).toBe(0);
    expect(container.querySelector('h1')?.textContent).toContain('90%');

    const retry = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Retry');
    await act(async () => retry?.click());
    expect(fetchRanking).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
