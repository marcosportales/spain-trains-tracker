import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Runs `sync` now if the style can take sources, and again after every style load, because
 * `setStyle` (a theme change) drops custom sources and layers. `sync` must add them if missing
 * and then push its current data. `isStyleLoaded()` dips to false while a source reloads, so an
 * existing source counts as ready too. Returns the cleanup.
 */
export function syncOnStyle(map: MapLibreMap, sourceId: string, sync: () => void): () => void {
  if (map.getSource(sourceId) || map.isStyleLoaded()) sync();
  map.on('style.load', sync);
  return () => {
    map.off('style.load', sync);
  };
}
