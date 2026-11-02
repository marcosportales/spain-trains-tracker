import { AttributionControl, Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import type { Theme } from '@/theme/tokens';
import { attributionHtml, mapStyleUrl, SPAIN_VIEW } from './map-config';

/** The theme whose basemap each map currently shows. */
const shownTheme = new WeakMap<MapLibreMap, Theme>();

/** A map of Spain with the basemap of `theme`, attribution and zoom controls. */
export function createMap(container: HTMLElement, theme: Theme): MapLibreMap {
  const map = new MapLibreMap({
    container,
    style: mapStyleUrl(theme),
    center: SPAIN_VIEW.center,
    zoom: SPAIN_VIEW.zoom,
    attributionControl: false,
    dragRotate: false,
  });
  shownTheme.set(map, theme);
  map.touchZoomRotate.disableRotation();
  map.addControl(new AttributionControl({ compact: false, customAttribution: attributionHtml() }));
  map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');
  return map;
}

/**
 * Swaps the basemap when the theme changed. `setStyle` drops every custom source and layer, so
 * the layers re-add themselves on `style.load` (see `syncOnStyle`). A full rebuild (`diff: false`)
 * is what guarantees that event fires.
 */
export function applyMapTheme(map: MapLibreMap, theme: Theme): void {
  if (shownTheme.get(map) === theme) return;
  shownTheme.set(map, theme);
  map.setStyle(mapStyleUrl(theme), { diff: false });
}
