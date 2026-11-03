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
});
