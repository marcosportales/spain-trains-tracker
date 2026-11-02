import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('is hidden from assistive tech and stops pulsing under reduced motion', () => {
    const html = renderToStaticMarkup(<Skeleton className="h-4 w-20" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('motion-reduce:animate-none');
    expect(html).toContain('h-4 w-20');
  });
});
