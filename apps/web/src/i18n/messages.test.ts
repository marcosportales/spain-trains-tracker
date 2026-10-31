import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import es from '../../messages/es.json';

const keys = (o: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

describe('messages', () => {
  it('es and en define the same keys', () => {
    expect(keys(en).sort()).toEqual(keys(es).sort());
  });

  it('footer carries the Renfe CC BY 4.0 attribution in every locale', () => {
    for (const m of [es, en]) {
      expect(m.Footer.attribution).toBe('Datos: Renfe (data.renfe.com), CC BY 4.0');
    }
  });
});
