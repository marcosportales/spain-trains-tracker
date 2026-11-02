import { Sun } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders an icon-only button with its aria-label and a hidden icon', () => {
    const html = renderToStaticMarkup(<Button icon={Sun} aria-label="Claro" />);
    expect(html).toContain('aria-label="Claro"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('type="button"');
  });

  it('requires aria-label on an icon-only button', () => {
    // @ts-expect-error icon-only buttons need an accessible name
    const bad = <Button icon={Sun} />;
    expect(bad).toBeDefined();
  });

  it('renders its label', () => {
    expect(renderToStaticMarkup(<Button>Guardar</Button>)).toContain('>Guardar<');
  });
});
