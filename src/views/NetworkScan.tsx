/* ─── Network Device Discovery & Inventory ─── */
import { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { scanSubnet } from '../utils/networkScan';
import { MetricCard } from '../components/MetricCard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { DiscoveredDevice } from '../types';

const DEVICE_TYPE_ICONS: Record<string, string> = {
  router: '🌐',
  camera: '📹',
  server: '🖥️',
  iot: '💡',
  computer: '💻',
  phone: '📱',
  unknown: '❓',
};

const DEVICE_TYPE_COLORS: Record<string, string> = {
  router: 'bg-blue-500/20 text-blue-400',
  camera: 'bg-purple-500/20 text-purple-400',
  server: 'bg-green-500/20 text-green-400',
  iot: 'bg-yellow-500/20 text-yellow-400',
  computer: 'bg-cyan-500/20 text-cyan-400',
  phone: 'bg-pink-500/20 text-pink-400',
  unknown: 'bg-gray-500/20 text-gray-400',
};

export function NetworkScanView() {
  const devices = useAppStore(s => s.devices);
  const addDevice = useAppStore(s => s.addDevice);
  const updateDevice = useAppStore(s => s.updateDevice);
  const removeDevice = useAppStore(s => s.removeDevice);
  const settings = useAppStore(s => s.settings);
  const setSetting = useAppStore(s => s.setSetting);
  const addTimelineEvent = useAppStore(s => s.addTimelineEvent);

  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, ip: '' });
  const [scanError, setScanError] = useState<string | null>(null);
  const [subnet, setSubnet] = useState(settings.networkSubnet);
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredDevice | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const sweepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;
  const uniqueTypes = [...new Set(devices.map(d => d.deviceType))];
  const totalOpenPorts = devices.reduce((sum, d) => sum + d.openPorts.length, 0);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    setProgress({ current: 0, total: 0, ip: '' });

    try {
      const found = await scanSubnet(subnet, (current, total, ip) => {
        setProgress({ current, total, ip });
      });

      for (const device of found) {
        addDevice(device);
      }

      if (found.length === 0) {
        setScanError('No devices found. Make sure the subnet is correct and you\'re on the same network.');
      }

      // Update subnet setting
      if (subnet !== settings.networkSubnet) {
        setSetting('networkSubnet', subnet);
      }
    } catch (err) {
      setScanError(`Scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    setScanning(false);
  }, [subnet, addDevice, setSetting, settings.networkSubnet]);

  // Re-sweep to check online/offline status
  const handleReSweep = useCallback(async () => {
    for (const device of devices) {
      try {
        const { probePort } = await import('../utils/networkScan');
        const result = await probePort(device.ip, device.openPorts[0] || 80);
        updateDevice(device.id, {
          status: result.open ? 'online' : 'offline',
          lastSeen: new Date().toISOString(),
        });
      } catch {
        updateDevice(device.id, { status: 'offline', lastSeen: new Date().toISOString() });
      }
    }
  }, [devices, updateDevice]);

  // Filter devices
  const filteredDevices = devices.filter(d => {
    if (filterType !== 'all' && d.deviceType !== filterType) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));

  // Cleanup sweep timer
  // Note: Not auto-starting periodic sweeps to avoid unnecessary network activity

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🛰️ Network Scan</h1>
          <p className="text-xs text-gray-500 mt-1">
            Discover devices on your local network (browser-based port scanning)
          </p>
        </div>
        <div className="flex gap-2">
          {devices.length > 0 && (
            <button
              onClick={handleReSweep}
              disabled={scanning}
              className="px-3 py-2 bg-surface-800 text-gray-400 rounded-lg hover:bg-surface-700 text-sm disabled:opacity-50"
            >
              🔄 Re-sweep
            </button>
          )}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-4 py-2 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 text-sm disabled:opacity-50"
          >
            {scanning ? `⏳ Scanning ${progress.ip}...` : '📡 Start Scan'}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard label="Total Devices" value={devices.length} />
        <MetricCard label="Online" value={onlineCount} />
        <MetricCard label="Offline" value={offlineCount} />
        <MetricCard label="Open Ports" value={totalOpenPorts} />
        <MetricCard label="Device Types" value={uniqueTypes.length} />
      </div>

      {/* Scan config */}
      <div className="flex gap-2 items-center">
        <label className="text-xs text-gray-500">Subnet:</label>
        <input
          type="text"
          value={subnet}
          onChange={e => setSubnet(e.target.value)}
          className="w-48 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm font-mono"
          placeholder="192.168.1.0/24"
          disabled={scanning}
        />
        {scanning && (
          <div className="flex-1">
            <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 transition-all duration-200"
                style={{ width: `${progress.total ? (progress.current / progress.total * 100) : 0}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-600 mt-0.5">
              {progress.current}/{progress.total} — {progress.ip}
            </div>
          </div>
        )}
      </div>

      {scanError && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
          {scanError}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Types</option>
          {uniqueTypes.map(t => (
            <option key={t} value={t}>{DEVICE_TYPE_ICONS[t]} {t}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="online">🟢 Online</option>
          <option value="offline">🔴 Offline</option>
        </select>
      </div>

      {/* Device list */}
      <ErrorBoundary>
        <div className="space-y-2 max-h-[calc(100vh-420px)] overflow-y-auto">
          {filteredDevices.length === 0 && !scanning && (
            <div className="text-center text-gray-500 py-12">
              <div className="text-4xl mb-4">🛰️</div>
              <p>No devices discovered yet</p>
              <p className="text-sm text-gray-600 mt-1">
                Click "Start Scan" to discover devices on your local network.
                The scan probes common HTTP ports (80, 443, 8080, 8443, 3000, 554) on each IP.
              </p>
              <p className="text-xs text-gray-600 mt-2">
                Note: Browser-based scanning has limitations. Only devices with open HTTP ports will be detected.
                For comprehensive scanning, use a dedicated network tool like nmap.
              </p>
            </div>
          )}

          {filteredDevices.map(device => (
            <button
              key={device.id}
              onClick={() => setSelectedDevice(selectedDevice?.id === device.id ? null : device)}
              className={`w-full text-left bg-surface-900/30 border rounded-lg p-3 hover:bg-surface-800/50 transition-colors ${
                selectedDevice?.id === device.id ? 'border-brand-500/30' : 'border-surface-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{DEVICE_TYPE_ICONS[device.deviceType]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium font-mono text-sm">{device.ip}</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full ${DEVICE_TYPE_COLORS[device.deviceType]}`}>
                      {device.deviceType}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`} />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">
                    {device.hostname !== device.ip ? device.hostname : 'Unknown device'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-500">
                    Ports: {device.openPorts.join(', ')}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    Last seen: {new Date(device.lastSeen).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {selectedDevice?.id === device.id && (
                <div className="mt-3 pt-3 border-t border-surface-800 grid grid-cols-2 gap-2 text-xs text-gray-400">
                  <div><span className="text-gray-500">IP:</span> {device.ip}</div>
                  <div><span className="text-gray-500">Type:</span> {device.deviceType}</div>
                  <div><span className="text-gray-500">Hostname:</span> {device.hostname}</div>
                  <div><span className="text-gray-500">Status:</span> {device.status}</div>
                  <div><span className="text-gray-500">First seen:</span> {new Date(device.firstSeen).toLocaleString()}</div>
                  <div><span className="text-gray-500">Last seen:</span> {new Date(device.lastSeen).toLocaleString()}</div>
                  {device.openPorts.length > 0 && (
                    <div className="col-span-2"><span className="text-gray-500">Open ports:</span> {device.openPorts.join(', ')}</div>
                  )}
                  {device.previousStatus && (
                    <div className="col-span-2"><span className="text-gray-500">Previous status:</span> {device.previousStatus}</div>
                  )}
                  <div className="col-span-2 flex gap-2 mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeDevice(device.id); }}
                      className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </ErrorBoundary>
    </div>
  );
}
