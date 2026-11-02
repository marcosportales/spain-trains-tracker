import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DetailSurface } from './DetailSurface';

describe('DetailSurface (server render = desktop panel)', () => {
  const html = renderToStaticMarkup(
    <DetailSurface label="Detalle del tren" headline={<h2>Va 7 min tarde</h2>} actions={<b>x</b>}>
      <p>Paradas</p>
    </DetailSurface>,
  );

  it('is an aside named by the label', () => {
    expect(html).toMatch(/^<aside[^>]*aria-label="Detalle del tren"/);
  });

  it('puts the headline before the children', () => {
    expect(html.indexOf('Va 7 min tarde')).toBeGreaterThan(-1);
    expect(html.indexOf('Va 7 min tarde')).toBeLessThan(html.indexOf('Paradas'));
  });
});
