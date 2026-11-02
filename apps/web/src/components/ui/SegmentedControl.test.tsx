import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const html = renderToStaticMarkup(
  <SegmentedControl
    aria-label="Tema"
    value="b"
    onChange={() => {}}
    options={[
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C', ariaLabel: 'Ce' },
    ]}
  />,
);

describe('SegmentedControl', () => {
  it('is a radiogroup with an accessible name', () => {
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Tema"');
  });

  it('renders one radio per option and checks only the selected one', () => {
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/aria-checked="false"/g)).toHaveLength(2);
  });

  it('makes only the selected radio tabbable, for arrow-key navigation', () => {
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
  });

  it('uses ariaLabel as the accessible name of an option', () => {
    expect(html).toContain('aria-label="Ce"');
  });
});
