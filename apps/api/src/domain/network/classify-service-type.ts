import type { ServiceType } from './service-type.js';

/** The two GTFS static feeds that carry Runs. */
export type GtfsFeedKind = 'cercanias' | 'larga-distancia';

export interface RouteClassificationInput {
  readonly feed: GtfsFeedKind;
  /** GTFS `route_short_name`. */
  readonly shortName: string;
  /** True when every Station the route stops at is metre-gauge (ancho métrico) only. */
  readonly onlyMetreGaugeStations?: boolean;
}

const AVE_NAMES = new Set(['AVE', 'AVLO', 'AV']);
const MEDIA_DISTANCIA_NAMES = new Set([
  'AVANT',
  'MD',
  'REGIONAL',
  'REGIONALES',
  'PROXIMIDAD',
  'TRENCELTA',
  'LANZADERA',
  'RAILCAR',
]);
const LARGA_DISTANCIA_NAMES = new Set([
  'ALVIA',
  'INTERCITY',
  'ALTARIA',
  'EUROMED',
  'TALGO',
  'TRENHOTEL',
  'ARCO',
  'ALARIS',
]);
const METRE_GAUGE_PATTERN = /\b(FEVE|ANCHO)/;
/** Catalan and other numbered regional lines: R11, R-14. */
const NUMBERED_REGIONAL_PATTERN = /^R-?\d+/;

/**
 * Maps a GTFS route to a Service type. `route_type` is not used: both feeds publish every route as
 * 2 (rail), so it cannot tell the families apart.
 *
 * - Cercanías feed: `cercanias`, or `ancho_metrico` when the route name says FEVE / ancho or all its
 *   Stations are metre-gauge only.
 * - AV/LD/MD feed, by the first word of `route_short_name` (accents and case ignored):
 *   - AVE, AVLO → `ave`
 *   - Avant, MD, Regional, R-nn, Proximidad, Trencelta, Lanzadera → `media_distancia`
 *   - Alvia, Intercity, Altaria, Euromed, Talgo, Trenhotel, Arco, Alaris → `larga_distancia`
 *   - FEVE / ancho → `ancho_metrico`
 *   - anything else → `larga_distancia` (the feed is mostly long-distance)
 */
export function classifyServiceType(input: RouteClassificationInput): ServiceType {
  const name = normalize(input.shortName);
  if (METRE_GAUGE_PATTERN.test(name)) return 'ancho_metrico';

  if (input.feed === 'cercanias') {
    return input.onlyMetreGaugeStations === true ? 'ancho_metrico' : 'cercanias';
  }

  const word = name.split(/[\s-]/)[0] ?? '';
  if (AVE_NAMES.has(word)) return 'ave';
  if (MEDIA_DISTANCIA_NAMES.has(word) || NUMBERED_REGIONAL_PATTERN.test(name)) {
    return 'media_distancia';
  }
  if (LARGA_DISTANCIA_NAMES.has(word)) return 'larga_distancia';
  return 'larga_distancia';
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}
