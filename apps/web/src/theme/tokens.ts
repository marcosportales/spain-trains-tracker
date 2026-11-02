import type { ServiceType } from '@stt/contracts';
import type { DelayBand } from '@/components/delay/delay-band';

/**
 * The TypeScript mirror of the colour tokens in `app/globals.css`, for places that cannot read
 * CSS variables (MapLibre paint, `og-image.tsx`). `tokens.test.ts` fails if the two drift.
 * Every value comes from **Validated values** in `docs/design/ui-redesign.md`.
 */
export type Theme = 'light' | 'dark';

export type ColorToken =
  | 'page'
  | 'surface'
  | 'surface-2'
  | 'surface-3'
  | 'line'
  | 'ink'
  | 'ink-2'
  | 'ink-3'
  | 'on-ink'
  | 'accent'
  | 'accent-soft'
  | 'dot-outline';

export const COLORS: Record<Theme, Record<ColorToken, string>> = {
  light: {
    page: '#e6e7ea',
    surface: '#ffffff',
    'surface-2': '#f4f4f5',
    'surface-3': '#e7e7ea',
    line: '#e4e4e7',
    ink: '#18181b',
    'ink-2': '#52525b',
    'ink-3': '#71717a',
    'on-ink': '#ffffff',
    accent: '#2563eb',
    'accent-soft': '#dbe6fd',
    'dot-outline': 'rgba(24, 24, 27, 0.55)',
  },
  dark: {
    page: '#0a0b0d',
    surface: '#1d1f23',
    'surface-2': '#25282d',
    'surface-3': '#30333a',
    line: '#30333a',
    ink: '#f4f4f5',
    'ink-2': '#c4c5cb',
    'ink-3': '#8e939c',
    'on-ink': '#18181b',
    accent: '#6ea8fe',
    'accent-soft': '#1c2c47',
    'dot-outline': 'rgba(244, 244, 245, 0.5)',
  },
};

/** Service types in display order. */
export const SERVICE_TYPES: readonly ServiceType[] = [
  'cercanias',
  'ave',
  'larga_distancia',
  'media_distancia',
  'ancho_metrico',
];

/** Categorical, and clear of the Delay band hues (green, amber, red, grey). */
export const SERVICE_TYPE_COLORS: Record<Theme, Record<ServiceType, string>> = {
  light: {
    cercanias: '#53c3b1',
    ave: '#ad9bfa',
    larga_distancia: '#0d60e0',
    media_distancia: '#8e2b86',
    ancho_metrico: '#8b440e',
  },
  dark: {
    cercanias: '#0c8568',
    ave: '#7943aa',
    larga_distancia: '#257bf1',
    media_distancia: '#ca68b9',
    ancho_metrico: '#a04b00',
  },
};

export type DelayBandColors = {
  /** The mark colour: map ring, bar, badge dot. For Unknown, the hollow ring. */
  strong: string;
  /** The badge background. For Cancelled, a solid background paired with `text`. */
  soft: string;
  /** Badge text colour; only Cancelled sets it (the others use `ink`). */
  text?: string;
};

export const DELAY_BAND_COLORS: Record<Theme, Record<DelayBand, DelayBandColors>> = {
  light: {
    on_time: { strong: '#1f9e55', soft: '#e3f4e9' },
    late: { strong: '#c27c00', soft: '#fbefd6' },
    severely_late: { strong: '#d6382f', soft: '#fbe3e1' },
    cancelled: { strong: '#868c96', soft: '#52525b', text: '#ffffff' },
    unknown: { strong: '#868c96', soft: '#ececee' },
  },
  dark: {
    on_time: { strong: '#3fbf74', soft: '#163322' },
    late: { strong: '#f0a832', soft: '#3a2c10' },
    severely_late: { strong: '#f2635a', soft: '#3d1c1a' },
    cancelled: { strong: '#8b919b', soft: '#4a4d55', text: '#f4f4f5' },
    unknown: { strong: '#8b919b', soft: '#2a2c31' },
  },
};

/** The CSS variable of a Service type's colour, for DOM swatches that follow the theme without JS. */
export const serviceTypeVar = (type: ServiceType): string =>
  `var(--color-service-${type.replaceAll('_', '-')})`;
