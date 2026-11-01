'use client';

import { AttributionControl, Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { attributionHtml, MAP_STYLE_URL, SPAIN_VIEW } from './map-config';

export function TrainMap({ label }: { label: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const map = new MapLibreMap({
      container: container.current,
      style: MAP_STYLE_URL,
      center: SPAIN_VIEW.center,
      zoom: SPAIN_VIEW.zoom,
      attributionControl: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ customAttribution: attributionHtml() }));
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    return () => map.remove();
  }, []);

  return <div ref={container} role="application" aria-label={label} className="h-full w-full" />;
}
