/* ─── Settings: Extended with map view mode, reset, export/import ─── */
import { useRef } from 'react';
import { useAppStore } from '../store';
import type { MapViewMode } from '../types';

const MAP_VIEW_OPTIONS: { value: MapViewMode; label: string }[] = [
  { value: '2d', label: '2D Map (MapLibre)' },
  { value: '3d', label: '3D Globe (Cesium)' },
  { value: 'split', label: 'Split View' },
];

export function SettingsView() {
  const settings = useAppStore(s => s.settings);
  const setSetting = useAppStore(s => s.setSetting);
  const resetToDefaults = useAppStore(s => s.resetToDefaults);
  const connectors = useAppStore(s => s.ingestionPoints);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = JSON.stringify(connectors, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'overglass-connectors.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        JSON.parse(reader.result as string);
        localStorage.setItem('overglass-connectors', reader.result as string);
        window.location.reload();
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleReset = () => {
    if (confirm('Reset all connectors and settings to defaults? This cannot be undone.')) {
      resetToDefaults();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl animate-fade-in">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="space-y-4">
        {/* Auto Refresh */}
        <div className="flex items-center justify-between bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <div>
            <h3 className="font-semibold">Auto Refresh</h3>
            <p className="text-sm text-gray-500">Periodically verify connector URLs</p>
          </div>
          <button
            onClick={() => setSetting('autoRefresh', !settings.autoRefresh)}
            className={`w-12 h-6 rounded-full transition-colors ${settings.autoRefresh ? 'bg-brand-500' : 'bg-surface-700'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.autoRefresh ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Refresh Interval */}
        <div className="flex items-center justify-between bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <div>
            <h3 className="font-semibold">Refresh Interval</h3>
            <p className="text-sm text-gray-500">How often to verify connectors</p>
          </div>
          <select
            value={settings.refreshInterval}
            onChange={(e) => setSetting('refreshInterval', Number(e.target.value))}
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value={5000}>5 seconds</option>
            <option value={10000}>10 seconds</option>
            <option value={30000}>30 seconds</option>
            <option value={60000}>1 minute</option>
            <option value={300000}>5 minutes</option>
          </select>
        </div>

        {/* Map View Mode */}
        <div className="flex items-center justify-between bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <div>
            <h3 className="font-semibold">Map View</h3>
            <p className="text-sm text-gray-500">Default map display mode</p>
          </div>
          <select
            value={settings.mapView}
            onChange={(e) => setSetting('mapView', e.target.value as MapViewMode)}
            className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
          >
            {MAP_VIEW_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Show Video Markers */}
        <div className="flex items-center justify-between bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <div>
            <h3 className="font-semibold">Show Video Markers</h3>
            <p className="text-sm text-gray-500">Display CV analysis markers on video feeds</p>
          </div>
          <button
            onClick={() => setSetting('showVideoMarkers', !settings.showVideoMarkers)}
            className={`w-12 h-6 rounded-full transition-colors ${settings.showVideoMarkers ? 'bg-brand-500' : 'bg-surface-700'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${settings.showVideoMarkers ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {/* Separator */}
        <div className="border-t border-surface-800 my-2" />

        {/* Export / Import */}
        <div className="flex items-center justify-between bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <div>
            <h3 className="font-semibold">Export Connectors</h3>
            <p className="text-sm text-gray-500">Download connector config as JSON</p>
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 transition-colors text-sm"
          >
            Export
          </button>
        </div>

        <div className="flex items-center justify-between bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <div>
            <h3 className="font-semibold">Import Connectors</h3>
            <p className="text-sm text-gray-500">Load connector config from JSON file</p>
          </div>
          <button
            onClick={() => importInputRef.current?.click()}
            className="px-4 py-2 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 transition-colors text-sm"
          >
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {/* Reset */}
        <div className="flex items-center justify-between bg-surface-900/30 border border-red-500/20 rounded-xl p-4">
          <div>
            <h3 className="font-semibold text-red-400">Reset to Defaults</h3>
            <p className="text-sm text-gray-500">Clear all connectors and settings</p>
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
          >
            Reset
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-600 p-4">
          <p>Connectors are stored in localStorage (key: <code className="bg-surface-800 px-1 rounded">overglass-connectors</code>).</p>
          <p className="mt-1">Settings stored in: <code className="bg-surface-800 px-1 rounded">overglass-settings</code>.</p>
          <p className="mt-1">HTTP/HTTPS connectors are verified via HEAD requests. RTSP, MQTT, Kafka, and other non-HTTP protocols cannot be verified from the browser and will show "unverified" status.</p>
        </div>
      </div>
    </div>
  );
}
