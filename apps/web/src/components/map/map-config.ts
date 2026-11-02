import type { Theme } from '@/theme/tokens';

/** The OpenFreeMap basemap for a theme: `positron` (light) or `dark`. */
export const mapStyleUrl = (theme: Theme): string =>
  `https://tiles.openfreemap.org/styles/${theme === 'dark' ? 'dark' : 'positron'}`;

export const SPAIN_VIEW = {
  center: [-3.7, 40.2] as [number, number],
  zoom: 5.4,
};

/** Minimum zoom when the map centres on a selected Run. */
export const SELECTED_ZOOM = 9;

export const ATTRIBUTION: { label: string; href: string }[] = [
  { label: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' },
  { label: 'OpenFreeMap', href: 'https://openfreemap.org' },
  { label: 'Renfe', href: 'https://data.renfe.com' },
];

export const attributionHtml = (): string =>
  ATTRIBUTION.map((a) => `<a href="${a.href}" target="_blank" rel="noopener">${a.label}</a>`).join(
    ' | ',
  );
