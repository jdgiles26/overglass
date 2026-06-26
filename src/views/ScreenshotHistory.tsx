/* ─── Screenshot History & Change Detection ─── */
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { getThumbnailUrl } from '../utils/screenshot';
import { MetricCard } from '../components/MetricCard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { ScreenshotRecord } from '../types';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

function ScreenshotCard({ record, onSelect, isSelected }: {
  record: ScreenshotRecord;
  onSelect: (r: ScreenshotRecord) => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(record)}
      className={`text-left bg-surface-900/30 border rounded-lg overflow-hidden transition-colors ${
        isSelected ? 'border-brand-500/30 ring-1 ring-brand-500/20' : 'border-surface-800 hover:border-surface-700'
      }`}
    >
      <div className="aspect-video bg-surface-800 relative">
        <img
          src={record.thumbnail}
          alt={`Screenshot of ${record.connectorName}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {record.changed && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-yellow-500/80 rounded text-[10px] text-black font-medium">
            CHANGED
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="text-xs font-medium truncate">{record.connectorName}</div>
        <div className="text-[10px] text-gray-500">{formatTime(record.timestamp)}</div>
      </div>
    </button>
  );
}

function ComparisonView({ before, after }: { before: ScreenshotRecord; after: ScreenshotRecord }) {
  return (
    <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Side-by-Side Comparison</h3>
        <span className="text-xs text-yellow-400">Change detected</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Before: {formatTime(before.timestamp)}</div>
          <div className="aspect-video bg-surface-800 rounded-lg overflow-hidden">
            <img
              src={before.thumbnail}
              alt="Before"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">After: {formatTime(after.timestamp)}</div>
          <div className="aspect-video bg-surface-800 rounded-lg overflow-hidden">
            <img
              src={after.thumbnail}
              alt="After"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-500 grid grid-cols-2 gap-1">
        <div>DOM Hash before: <code className="bg-surface-800 px-1 rounded">{before.domHash}</code></div>
        <div>DOM Hash after: <code className="bg-surface-800 px-1 rounded">{after.domHash}</code></div>
      </div>
    </div>
  );
}

export function ScreenshotHistoryView() {
  const screenshots = useAppStore(s => s.screenshots);
  const connectors = useAppStore(s => s.ingestionPoints);
  const addScreenshot = useAppStore(s => s.addScreenshot);
  const addTimelineEvent = useAppStore(s => s.addTimelineEvent);

  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ScreenshotRecord | null>(null);
  const [compareRecord, setCompareRecord] = useState<ScreenshotRecord | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Website-type connectors
  const websiteConnectors = connectors.filter(c =>
    c.type === 'website' || c.type === 'rss' ||
    (c.url && (c.url.startsWith('http://') || c.url.startsWith('https://')) && c.type !== 'rtsp')
  );

  // Filter screenshots by selected connector
  const filteredScreenshots = selectedConnector
    ? screenshots.filter(s => s.connectorId === selectedConnector)
    : screenshots;

  // Sort by timestamp desc
  const sortedScreenshots = [...filteredScreenshots].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Manual screenshot capture
  const captureManual = useCallback(async (connectorId: string) => {
    const connector = connectors.find(c => c.id === connectorId);
    if (!connector?.url) return;

    setCapturing(true);
    try {
      const { captureScreenshot, getConnectorScreenshots } = await import('../utils/screenshot');
      const { createEvent } = await import('../utils/timeline');

      // Get previous hash
      const prev = getConnectorScreenshots(connectorId);
      const prevHash = prev.length > 0 ? prev[0].domHash : undefined;

      const result = await captureScreenshot(connectorId, connector.name, connector.url, prevHash);
      if (result) {
        addScreenshot(result.record);

        if (result.changed) {
          addTimelineEvent(createEvent(
            'screenshot.change_detected',
            `Change detected: ${connector.name}`,
            `DOM hash changed from ${prevHash} to ${result.record.domHash}`,
            { severity: 'warning', connectorId, connectorName: connector.name },
          ));
        } else {
          addTimelineEvent(createEvent(
            'screenshot.captured',
            `Screenshot captured: ${connector.name}`,
            `DOM hash: ${result.record.domHash}`,
            { severity: 'info', connectorId, connectorName: connector.name },
          ));
        }
      }
    } catch (err) {
      console.error('Screenshot capture failed:', err);
    }
    setCapturing(false);
  }, [connectors, addScreenshot, addTimelineEvent]);

  // Auto-detect changes between consecutive screenshots
  const changes = sortedScreenshots.filter((s, i) => {
    if (i >= sortedScreenshots.length - 1) return false;
    const next = sortedScreenshots[i + 1];
    return s.connectorId === next.connectorId && s.domHash !== next.domHash;
  });

  const totalCaptures = screenshots.length;
  const connectorsWithCaps = new Set(screenshots.map(s => s.connectorId)).size;

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📸 Screenshots</h1>
          <p className="text-xs text-gray-500 mt-1">
            Website monitoring with change detection (thumbnails via thum.io)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Captures" value={totalCaptures} />
        <MetricCard label="Monitored Sites" value={connectorsWithCaps} />
        <MetricCard label="Changes Detected" value={changes.length} />
        <MetricCard label="Available Connectors" value={websiteConnectors.length} />
      </div>

      {/* Connector filter + capture buttons */}
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={selectedConnector ?? ''}
          onChange={e => { setSelectedConnector(e.target.value || null); setSelectedRecord(null); setCompareRecord(null); }}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All connectors</option>
          {websiteConnectors.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
          ))}
        </select>
        <button
          onClick={() => { if (selectedConnector) captureManual(selectedConnector); }}
          disabled={capturing || !selectedConnector}
          className="px-3 py-2 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 text-sm disabled:opacity-50"
        >
          {capturing ? '⏳ Capturing...' : '📸 Capture Now'}
        </button>
      </div>

      {/* Comparison view */}
      {selectedRecord && compareRecord && (
        <ComparisonView before={compareRecord} after={selectedRecord} />
      )}

      {/* Screenshot grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedScreenshots.map(s => (
          <ScreenshotCard
            key={s.id}
            record={s}
            isSelected={selectedRecord?.id === s.id}
            onSelect={(r) => {
              if (selectedRecord && selectedRecord.id !== r.id && selectedRecord.connectorId === r.connectorId) {
                setCompareRecord(selectedRecord);
              } else {
                setCompareRecord(null);
              }
              setSelectedRecord(r);
            }}
          />
        ))}
      </div>

      {sortedScreenshots.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <div className="text-4xl mb-4">📸</div>
          <p>No screenshots yet</p>
          <p className="text-sm text-gray-600 mt-1">
            Select a website connector and click "Capture Now" to take a screenshot.
            Screenshots use the thum.io service for cross-origin capture.
          </p>
        </div>
      )}

      {/* Recent changes */}
      {changes.length > 0 && (
        <div className="mt-4">
          <h2 className="font-semibold text-yellow-400 mb-2">Recent Changes ({changes.length})</h2>
          <div className="space-y-2">
            {changes.slice(0, 10).map(s => (
              <div key={s.id} className="flex items-center gap-3 text-sm bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                <span className="text-yellow-400">🔍</span>
                <div>
                  <div className="font-medium">{s.connectorName}</div>
                  <div className="text-xs text-gray-500">
                    Changed at {formatTime(s.timestamp)} — Hash: {s.domHash}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
