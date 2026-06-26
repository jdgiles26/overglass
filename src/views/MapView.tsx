/* ─── MapView: Toggle between 2D/3D/split views ─── */
import { useState, lazy, Suspense, useCallback } from 'react';
import { useAppStore } from '../store';
import type { IngestionPoint, MapViewMode } from '../types';
import { MetricCard } from '../components/MetricCard';

// Lazy load the map components so Cesium (~50MB) isn't loaded until needed
const Map2D = lazy(() => import('./Map2D').then(m => ({ default: m.Map2D })));
const Map3D = lazy(() => import('./Map3D').then(m => ({ default: m.Map3D })));

const VIEW_OPTIONS: { mode: MapViewMode; label: string; icon: string }[] = [
  { mode: '2d', label: '2D Map', icon: '🗺️' },
  { mode: '3d', label: '3D Globe', icon: '🌐' },
  { mode: 'split', label: 'Split', icon: '⬜' },
];

export function MapView() {
  const points = useAppStore(s => s.ingestionPoints);
  const feeds = useAppStore(s => s.videoFeeds);
  const settings = useAppStore(s => s.settings);
  const setSetting = useAppStore(s => s.setSetting);
  const [selectedPoint, setSelectedPoint] = useState<IngestionPoint | null>(null);

  const activeCount = points.filter(p => p.status === 'active').length;
  const errorCount = points.filter(p => p.status === 'error').length;
  const unverifiedCount = points.filter(p => p.status === 'unverified').length;
  const totalBps = points.reduce((s, p) => s + p.dataRateBps, 0);

  const handleNodeClick = useCallback((point: IngestionPoint) => {
    setSelectedPoint(point);
  }, []);

  const mapView = settings.mapView;
  const is2D = mapView === '2d' || mapView === 'split';
  const is3D = mapView === '3d' || mapView === 'split';

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">Global Map</h1>
          <div className="flex gap-1">
            {VIEW_OPTIONS.map(opt => (
              <button
                key={opt.mode}
                onClick={() => setSetting('mapView', opt.mode)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  settings.mapView === opt.mode
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                    : 'text-gray-500 hover:bg-surface-800 hover:text-gray-300 border border-transparent'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 text-sm text-gray-400">
          <span>{points.length} connectors</span>
          <span className="text-green-400">{activeCount} active</span>
          <span className="text-red-400">{errorCount} errors</span>
          <span className="text-gray-500">{unverifiedCount} unverified</span>
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative min-h-0">
        {mapView === 'split' ? (
          <div className="flex h-full">
            <div className="flex-1 relative">
              <Suspense fallback={<MapLoading label="Loading 2D map..." />}>
                <Map2D onNodeClick={handleNodeClick} selectedId={selectedPoint?.id} />
              </Suspense>
            </div>
            <div className="w-px bg-surface-800" />
            <div className="flex-1 relative">
              <Suspense fallback={<MapLoading label="Loading 3D globe..." />}>
                <Map3D onNodeClick={handleNodeClick} selectedId={selectedPoint?.id} />
              </Suspense>
            </div>
          </div>
        ) : mapView === '3d' ? (
          <Suspense fallback={<MapLoading label="Loading 3D globe..." />}>
            <Map3D onNodeClick={handleNodeClick} selectedId={selectedPoint?.id} />
          </Suspense>
        ) : (
          <Suspense fallback={<MapLoading label="Loading 2D map..." />}>
            <Map2D onNodeClick={handleNodeClick} selectedId={selectedPoint?.id} />
          </Suspense>
        )}

        {/* Selected node panel */}
        {selectedPoint && (
          <div className="absolute top-3 right-3 bg-surface-900/95 border border-surface-700 rounded-xl p-4 text-sm min-w-[240px] backdrop-blur-sm z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{selectedPoint.name}</div>
              <button
                onClick={() => setSelectedPoint(null)}
                className="text-gray-500 hover:text-gray-300 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-3">{selectedPoint.location} · {selectedPoint.region}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Status:</span>{' '}
                <span className={
                  selectedPoint.status === 'active' ? 'text-green-400' :
                  selectedPoint.status === 'error' ? 'text-red-400' :
                  selectedPoint.status === 'connecting' ? 'text-yellow-400' :
                  'text-gray-400'
                }>
                  {selectedPoint.status}
                </span>
              </div>
              <div><span className="text-gray-500">Type:</span> {selectedPoint.type}</div>
              <div><span className="text-gray-500">Protocol:</span> {selectedPoint.protocol}</div>
              <div><span className="text-gray-500">Rate:</span> {selectedPoint.dataRate}</div>
              <div><span className="text-gray-500">Latency:</span> {selectedPoint.metrics.latency}ms</div>
              <div><span className="text-gray-500">Last:</span> {selectedPoint.lastSeen}</div>
              {selectedPoint.httpStatus !== undefined && (
                <div><span className="text-gray-500">HTTP:</span> {selectedPoint.httpStatus}</div>
              )}
              {selectedPoint.responseTime !== undefined && (
                <div><span className="text-gray-500">Resp:</span> {selectedPoint.responseTime}ms</div>
              )}
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {selectedPoint.tags.map(t => (
                <span key={t} className="px-2 py-0.5 text-[10px] bg-surface-800 rounded-full text-gray-400">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom metrics */}
      <div className="px-4 py-3 border-t border-surface-800 shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Total Throughput" value={(totalBps / 1e9).toFixed(1)} unit="GB/s" />
          <MetricCard label="Active" value={activeCount} />
          <MetricCard label="Errors" value={errorCount} />
          <MetricCard label="Video Feeds" value={feeds.length} />
        </div>
      </div>
    </div>
  );
}

function MapLoading({ label }: { label: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-surface-950 text-gray-500">
      <div className="text-center">
        <div className="text-2xl mb-2 animate-pulse">🗺️</div>
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
