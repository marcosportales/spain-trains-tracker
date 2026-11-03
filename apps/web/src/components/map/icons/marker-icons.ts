import type { ServiceType } from '@stt/contracts';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { COLORS, DELAY_BAND_COLORS, SERVICE_TYPE_COLORS, type Theme } from '@/theme/tokens';

/**
 * The map's markers: small rounded-square badges with a pictogram, like a metro sign. Run badges
 * carry a train front in white on their Service type colour; Stations carry a station building in
 * the surface colour on ink. Delay rings, the selected Run's halo and the selected Station's ring
 * are rounded-square frames around them. Each is drawn on a canvas and registered as a MapLibre
 * image, and the legend draws the same glyphs as inline SVG (`MarkerBadge`).
 */

/** Pictograms in a 24-unit box, filled with the even-odd rule (windows and lights are holes). */
export const GLYPH_PATHS = {
  train:
    'M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z' +
    'M8.5 5.5h7a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z' +
    'M9.75 13.5a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 1 1 2.5 0Z' +
    'M16.75 13.5a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 1 1 2.5 0Z' +
    'M8.2 18h2.1l-1.5 3H6.7Z' +
    'M15.8 18h-2.1l1.5 3h2.1Z',
  station:
    'M12 3 3.5 7.5v2h17v-2Z' +
    'M5 11h2.5v6H5Z' +
    'M10.75 11h2.5v6h-2.5Z' +
    'M16.5 11H19v6h-2.5Z' +
    'M3.5 18.5h17V21h-17Z',
} as const;

export type Glyph = keyof typeof GLYPH_PATHS;

/** One map image: a rounded square `size` CSS pixels wide, optionally with a centred glyph. */
export type MarkerSpec = {
  size: number;
  radius: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  glyph?: Glyph;
  glyphColor?: string;
};

/** Badge sizes in CSS pixels; layers scale them with `icon-size`. */
export const RUN_BADGE_SIZE = 16;
export const STATION_BADGE_SIZE = 14;
export const RUN_BADGE_RADIUS = 4;
const STATION_BADGE_RADIUS = 3.5;
/** The glyph covers this share of the badge; glyph paths are drawn in a box this many units wide. */
export const GLYPH_SHARE = 0.8;
export const GLYPH_UNITS = 24;
/** Run pictograms are white in both themes, like a metro sign; not a theme token on purpose. */
export const RUN_GLYPH_COLOR = '#ffffff';
/** Layout for marker layers: collisions never hide a marker, however crowded the map. */
export const ALWAYS_SHOWN = { 'icon-allow-overlap': true, 'icon-ignore-placement': true } as const;
/** A frame (Delay ring, selected Station) sits this far outside the badge's edge. */
const FRAME_GAP = 2;
const FRAME_WIDTH = 2.2;
/** The selected Run's halo reaches this far beyond its badge, before the selection scale. */
const HALO_MARGIN = 5.3;

const frame = (badge: number, radius: number, stroke: string): MarkerSpec => ({
  size: badge + 2 * (FRAME_GAP + FRAME_WIDTH),
  radius: radius + FRAME_GAP + FRAME_WIDTH / 2,
  stroke,
  strokeWidth: FRAME_WIDTH,
});

/** The badge a Run is drawn with: solid in its Service type colour, hollow when snapped. */
export const runIconId = (serviceType: ServiceType | undefined, snapped: boolean): string =>
  `run-${snapped ? 'hollow-' : ''}${serviceType ?? 'unknown'}`;

/** Every marker image for `theme`, by image id. */
export function markerImages(theme: Theme): Record<string, MarkerSpec> {
  const colors = COLORS[theme];
  const bands = DELAY_BAND_COLORS[theme];
  const runColors: [string, string][] = [
    ...Object.entries(SERVICE_TYPE_COLORS[theme]),
    ['unknown', colors['ink-3']],
  ];
  const images: Record<string, MarkerSpec> = {};
  for (const [type, color] of runColors) {
    // The 1 px outline keeps every badge legible on the basemap (see `dot-outline`).
    images[`run-${type}`] = {
      size: RUN_BADGE_SIZE,
      radius: RUN_BADGE_RADIUS,
      fill: color,
      stroke: colors['dot-outline'],
      strokeWidth: 1,
      glyph: 'train',
      glyphColor: RUN_GLYPH_COLOR,
    };
    images[`run-hollow-${type}`] = {
      size: RUN_BADGE_SIZE,
      radius: RUN_BADGE_RADIUS,
      fill: colors.surface,
      stroke: color,
      strokeWidth: 2,
      glyph: 'train',
      glyphColor: color,
    };
  }
  images['run-ring-late'] = frame(RUN_BADGE_SIZE, RUN_BADGE_RADIUS, bands.late.strong);
  images['run-ring-severely_late'] = frame(
    RUN_BADGE_SIZE,
    RUN_BADGE_RADIUS,
    bands.severely_late.strong,
  );
  images['run-halo'] = {
    size: RUN_BADGE_SIZE + 2 * HALO_MARGIN,
    radius: RUN_BADGE_RADIUS + HALO_MARGIN,
    fill: colors.accent,
  };
  images.station = {
    size: STATION_BADGE_SIZE,
    radius: STATION_BADGE_RADIUS,
    fill: colors.ink,
    stroke: colors.surface,
    strokeWidth: 1,
    glyph: 'station',
    glyphColor: colors.surface,
  };
  images['station-selected'] = frame(STATION_BADGE_SIZE, STATION_BADGE_RADIUS, colors.accent);
  return images;
}

/** Draws `spec` at `pixelRatio` device pixels per CSS pixel; undefined without a 2D canvas. */
function rasterize(spec: MarkerSpec, pixelRatio: number): ImageData | undefined {
  const pixels = Math.ceil(spec.size * pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.scale(pixelRatio, pixelRatio);
  const inset = (spec.strokeWidth ?? 0) / 2;
  ctx.beginPath();
  ctx.roundRect(inset, inset, spec.size - 2 * inset, spec.size - 2 * inset, spec.radius - inset);
  if (spec.fill) {
    ctx.fillStyle = spec.fill;
    ctx.fill();
  }
  if (spec.stroke && spec.strokeWidth) {
    ctx.strokeStyle = spec.stroke;
    ctx.lineWidth = spec.strokeWidth;
    ctx.stroke();
  }
  if (spec.glyph && spec.glyphColor) {
    const box = spec.size * GLYPH_SHARE;
    ctx.translate((spec.size - box) / 2, (spec.size - box) / 2);
    ctx.scale(box / GLYPH_UNITS, box / GLYPH_UNITS);
    ctx.fillStyle = spec.glyphColor;
    ctx.fill(new Path2D(GLYPH_PATHS[spec.glyph]), 'evenodd');
  }
  return ctx.getImageData(0, 0, pixels, pixels);
}

/**
 * Registers (or repaints, after a theme change) the marker images whose id starts with `prefix`.
 * Drawn at twice the device pixel ratio, so the selected Run stays sharp when scaled up.
 */
export function addMarkerImages(map: MapLibreMap, theme: Theme, prefix: string): void {
  const pixelRatio = Math.ceil(Math.max(window.devicePixelRatio || 1, 1)) * 2;
  for (const [id, spec] of Object.entries(markerImages(theme))) {
    if (!id.startsWith(prefix)) continue;
    const image = rasterize(spec, pixelRatio);
    if (!image) continue;
    if (map.hasImage(id)) map.updateImage(id, image);
    else map.addImage(id, image, { pixelRatio });
  }
}
