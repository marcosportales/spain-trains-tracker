import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COLORS,
  DELAY_BAND_COLORS,
  SERVICE_TYPE_COLORS,
  SERVICE_TYPES,
  serviceTypeVar,
  type Theme,
} from './tokens';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

/** The body of the first `{ … }` block that follows `header`. */
function block(header: string): string {
  const start = css.indexOf(header);
  if (start === -1) throw new Error(`globals.css has no "${header}" block`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unterminated "${header}" block`);
}

const BLOCKS: Record<Theme, string> = {
  light: block('@theme'),
  dark: block(':root[data-theme="dark"]'),
};

const kebab = (s: string) => s.replaceAll('_', '-');

/** Every (variable, value) pair `tokens.ts` declares for a theme. */
function expectedVariables(theme: Theme): [string, string][] {
  const vars: [string, string][] = [];
  for (const [token, value] of Object.entries(COLORS[theme])) {
    vars.push([`--color-${token}`, value]);
  }
  for (const [type, value] of Object.entries(SERVICE_TYPE_COLORS[theme])) {
    vars.push([`--color-service-${kebab(type)}`, value]);
  }
  for (const [band, { strong, soft, text }] of Object.entries(DELAY_BAND_COLORS[theme])) {
    vars.push([`--color-band-${kebab(band)}`, strong]);
    vars.push([`--color-band-${kebab(band)}-soft`, soft]);
    if (text) vars.push([`--color-band-${kebab(band)}-text`, text]);
  }
  return vars;
}

describe.each(['light', 'dark'] as const)('tokens.ts and globals.css agree (%s)', (theme) => {
  it.each(expectedVariables(theme))('%s is %s', (name, value) => {
    const match = new RegExp(`${name}:\\s*([^;]+);`).exec(BLOCKS[theme]);
    expect(match, `${name} missing from the ${theme} block`).not.toBeNull();
    expect(match?.[1]?.trim().toLowerCase()).toBe(value.toLowerCase());
  });
});

describe('serviceTypeVar', () => {
  it.each(SERVICE_TYPES)('%s points at a variable that exists in globals.css', (type) => {
    const name = /var\((--[^)]+)\)/.exec(serviceTypeVar(type))?.[1];
    expect(name).toBeDefined();
    expect(BLOCKS.light).toContain(`${name}:`);
    expect(BLOCKS.dark).toContain(`${name}:`);
  });
});

/** WCAG 2.x contrast ratio of two `#rrggbb` colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r = 0, g = 0, bl = 0] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe.each(['light', 'dark'] as const)('Delay band badge text contrast (%s)', (theme) => {
  it.each(Object.entries(DELAY_BAND_COLORS[theme]))('%s reads at 4.5:1 or better', (_band, c) => {
    // Badge text is `ink`, except Cancelled, which carries its own text colour.
    expect(contrast(c.text ?? COLORS[theme].ink, c.soft)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('SERVICE_TYPES', () => {
  it.each(['light', 'dark'] as const)('has a colour in %s for every Service type', (theme) => {
    expect(Object.keys(SERVICE_TYPE_COLORS[theme]).sort()).toEqual([...SERVICE_TYPES].sort());
  });
});
