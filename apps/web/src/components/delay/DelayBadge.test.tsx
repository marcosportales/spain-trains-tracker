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

describe('DelayBadge marks', () => {
  it.each([
    ['on_time', 'bg-band-on-time'],
    ['late', 'bg-band-late'],
    ['severely_late', 'bg-band-severely-late'],
  ] as const)('%s has a leading dot in its strong colour', (band, dot) => {
    const html = render(band, 420);
    expect(html).toContain(`size-2 shrink-0 rounded-full ${dot}"`);
    expect(html).toContain(`${dot}-soft`);
  });

  it('cancelled is solid with no dot, and unknown has a hollow ring', () => {
    expect(render('cancelled')).not.toContain('size-2');
    expect(render('cancelled')).toContain('text-band-cancelled-text');
    expect(render('unknown')).toContain('border-band-unknown');
  });
});
