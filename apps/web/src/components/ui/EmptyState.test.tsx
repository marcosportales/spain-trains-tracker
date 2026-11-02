import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the sentence alone without an action', () => {
    const html = renderToStaticMarkup(<EmptyState message="Ningún tren" />);
    expect(html).toContain('Ningún tren');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a');
  });

  it('renders a button for an onAction action', () => {
    const html = renderToStaticMarkup(
      <EmptyState message="Ningún tren" action={{ label: 'Quitar filtros', onAction: () => {} }} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain('Quitar filtros');
  });

  it('renders a link for an href action', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={{}}>
        <EmptyState message="Ningún tren" action={{ label: 'Ir al mapa', href: '/punctuality' }} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('href="/es/punctuality"');
    expect(html).toContain('<a ');
    expect(html).toContain('Ir al mapa');
  });
});
