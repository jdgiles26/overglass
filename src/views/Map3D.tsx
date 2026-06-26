/* ─── Map3D: Cesium 3D globe with connector entities ─── */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '../store';
import type { IngestionPoint } from '../types';

// Set Cesium base URL to CDN (no local assets needed)
(window as any).CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.124/Build/Cesium/';

interface Map3DProps {
  onNodeClick?: (point: IngestionPoint) => void;
  selectedId?: string | null;
}

const STATUS_COLORS: Record<string, any> = {
  active: 0x22c55e,
  connecting: 0xf59e0b,
  error: 0xef4444,
  inactive: 0x6b7280,
  degraded: 0xf97316,
  unverified: 0x6b7280,
};

export function Map3D({ onNodeClick, selectedId }: Map3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const entityIdsRef = useRef<Set<string>>(new Set());
  const points = useAppStore(s => s.ingestionPoints);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dynamically import Cesium
  useEffect(() => {
    import('cesium')
      .then((Cesium: any) => {
        setLoaded(true);
        initCesium(Cesium);
      })
      .catch((err: any) => {
        console.error('Failed to load Cesium:', err);
        setLoadError(err.message || 'Failed to load Cesium');
      });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  const initCesium = useCallback((Cesium: any) => {
    if (!containerRef.current || viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      imageryProvider: new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        maximumLevel: 18,
        credit: new Cesium.Credit('OpenStreetMap contributors'),
      }),
      terrainProvider: undefined,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: true,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      vrButton: false,
      infoBox: false,
      selectionIndicator: false,
    });

    // Dark sky/atmosphere
    viewer.scene.skyAtmosphere.brightnessShift = -0.3;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0e17');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#111827');

    // Click handler for entity selection
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id) {
        const point = points.find(p => p.id === picked.id);
        if (point) onNodeClick?.(point);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    viewerRef.current = viewer;
    entityIdsRef.current = new Set();
  }, [onNodeClick, points]);

  // Sync entities when points change
  useEffect(() => {
    if (!loaded || !viewerRef.current) return;
    const Cesium = (window as any).Cesium;
    if (!Cesium) return;

    const viewer = viewerRef.current;
    const currentIds = new Set(points.map(p => p.id));

    // Remove entities that no longer exist
    for (const oldId of entityIdsRef.current) {
      if (!currentIds.has(oldId)) {
        const entity = viewer.entities.getById(oldId);
        if (entity) viewer.entities.remove(entity);
      }
    }

    // Add or update entities
    for (const p of points) {
      const color = Cesium.Color.fromCssColorString(
        p.status === 'active' ? '#22c55e' :
        p.status === 'error' ? '#ef4444' :
        p.status === 'connecting' ? '#f59e0b' :
        p.status === 'degraded' ? '#f97316' : '#6b7280'
      );

      if (viewer.entities.getById(p.id)) {
        const entity = viewer.entities.getById(p.id);
        entity.position = Cesium.Cartesian3.fromDegrees(p.lng, p.lat);
        entity.point.color = color;
      } else {
        viewer.entities.add({
          id: p.id,
          position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat),
          point: {
            pixelSize: 10,
            color: color,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: p.name,
            font: '12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
    }

    entityIdsRef.current = currentIds;
  }, [points, loaded]);

  // Fly to selected node
  useEffect(() => {
    if (!loaded || !viewerRef.current || !selectedId) return;
    const Cesium = (window as any).Cesium;
    if (!Cesium) return;

    const point = points.find(p => p.id === selectedId);
    if (!point) return;

    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(point.lng, point.lat, 5000000),
      duration: 1.5,
    });
  }, [selectedId, points, loaded]);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-950 text-gray-500">
        <div className="text-center">
          <div className="text-2xl mb-2">🌐</div>
          <p className="text-sm">Failed to load 3D globe</p>
          <p className="text-xs text-gray-600 mt-1">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-950 text-gray-500">
        <div className="text-center">
          <div className="text-2xl mb-2 animate-pulse">🌐</div>
          <p className="text-sm">Loading 3D globe...</p>
          <p className="text-xs text-gray-600 mt-1">Cesium is ~50MB — first load may take a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
