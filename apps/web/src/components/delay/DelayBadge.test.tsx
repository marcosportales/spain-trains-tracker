import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import es from '../../../messages/es.json';
import { DelayBadge } from './DelayBadge';
import type { DelayBand } from './delay-band';

const render = (band: DelayBand, delaySeconds?: number) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="es" messages={es}>
      <DelayBadge band={band} delaySeconds={delaySeconds} data-testid="b" />
    </NextIntlClientProvider>,
  );

describe('DelayBadge', () => {
  it.each([
    ['on_time', undefined, 'Puntual'],
    ['late', 420, '7 min de retraso'],
    ['severely_late', 1200, '20 min de retraso'],
    ['cancelled', undefined, 'Cancelado'],
    ['unknown', undefined, 'Sin datos de retraso'],
  ] as const)('%s renders its text and data-badge', (band, seconds, text) => {
    const html = render(band, seconds);
    expect(html).toContain(`data-badge="${band}"`);
    expect(html).toContain('data-testid="b"');
    expect(html).toContain(`>${text}<`);
  });
});
