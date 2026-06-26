/* ─── Map2D: MapLibre GL dark map with connector nodes ─── */
import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAppStore } from '../store';
import type { IngestionPoint } from '../types';

interface Map2DProps {
  onNodeClick?: (point: IngestionPoint) => void;
  selectedId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  connecting: '#f59e0b',
  error: '#ef4444',
  inactive: '#6b7280',
  degraded: '#f97316',
  unverified: '#6b7280',
};

export function Map2D({ onNodeClick, selectedId }: Map2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const points = useAppStore(s => s.ingestionPoints);
  const pointsRef = useRef(points);

  useEffect(() => { pointsRef.current = points; }, [points]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        name: 'OverGlass Dark',
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors © CARTO',
          },
          'connectors': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'connector-heat',
            type: 'heatmap',
            source: 'connectors',
            maxzoom: 9,
            paint: {
              'heatmap-weight': ['get', 'weight'],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(33,33,33,0)',
                0.2, 'rgba(99,102,241,0.3)',
                0.5, 'rgba(99,102,241,0.6)',
                0.8, 'rgba(99,102,241,0.8)',
                1, 'rgba(239,68,68,0.9)',
              ],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 9, 30],
              'heatmap-opacity': 0.6,
            },
          },
          {
            id: 'connector-circles',
            type: 'circle',
            source: 'connectors',
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                2, 4,
                10, 8,
              ],
              'circle-color': ['get', 'color'],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff33',
            },
          },
          {
            id: 'connector-labels',
            type: 'symbol',
            source: 'connectors',
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 11,
              'text-offset': [0, 1.5],
              'text-anchor': 'top',
              'text-max-width': 8,
            },
            paint: {
              'text-color': '#e2e8f0',
              'text-halo-color': '#0a0e17',
              'text-halo-width': 1.5,
            },
          },
        ],
      },
      center: [0, 25],
      zoom: 2,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    map.on('click', 'connector-circles', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['connector-circles'] });
      if (!features.length) return;
      const props = features[0].properties;
      const point = pointsRef.current.find(p => p.id === props?.id);
      if (point) onNodeClick?.(point);
    });

    map.on('mouseenter', 'connector-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'connector-circles', () => {
      map.getCanvas().style.cursor = '';
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onNodeClick]);

  // Update GeoJSON source when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource('connectors') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features = points.map(p => ({
      type: 'Feature' as const,
      properties: {
        id: p.id,
        name: p.name,
        color: STATUS_COLORS[p.status] || '#6b7280',
        status: p.status,
        weight: p.dataRateBps > 0 ? Math.min(1, p.dataRateBps / 400_000_000) : 0.3,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [p.lng, p.lat],
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
  }, [points]);

  const flyTo = useCallback((point: IngestionPoint) => {
    mapRef.current?.flyTo({
      center: [point.lng, point.lat],
      zoom: 6,
      duration: 1500,
    });
  }, []);

  // Fly to selected node
  useEffect(() => {
    if (selectedId) {
      const point = points.find(p => p.id === selectedId);
      if (point) flyTo(point);
    }
  }, [selectedId, points, flyTo]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
