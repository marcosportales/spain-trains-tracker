import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { RunChips } from './RunChips';

const render = (props: { wheelchairAccessible?: boolean; rollingStock?: string }) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <RunChips {...props} />
    </NextIntlClientProvider>,
  );

describe('RunChips', () => {
  it('shows accessibility and Rolling stock when both are known', () => {
    const html = render({ wheelchairAccessible: true, rollingStock: 'S-103' });
    expect(html).toContain('Wheelchair accessible');
    expect(html).toContain('Train model: S-103');
  });

  it('says when the train is not accessible', () => {
    expect(render({ wheelchairAccessible: false })).toContain('Not accessible');
  });

  it('shows only the value that is known', () => {
    const html = render({ rollingStock: 'S-103' });
    expect(html).toContain('Train model: S-103');
    expect(html).not.toContain('ccessible');
  });

  it('renders nothing without values', () => {
    expect(render({})).toBe('');
  });
});
