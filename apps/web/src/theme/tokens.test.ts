import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLORS, DELAY_BAND_COLORS, SERVICE_TYPE_COLORS, type Theme } from './tokens';

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
