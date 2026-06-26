/* ─── ConnectorsConfig: Form to add/edit/remove connectors ─── */
import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../store';
import { StatusBadge } from '../components/StatusBadge';
import type { ConnectorType, ConnectorFormData, IngestionPoint } from '../types';

const CONNECTOR_TYPES: { value: ConnectorType; label: string }[] = [
  { value: 'rest-api', label: 'REST API' },
  { value: 'connector', label: 'Generic Connector' },
  { value: 'rtsp', label: 'RTSP Stream' },
  { value: 'hls', label: 'HLS / m3u8' },
  { value: 'mqtt', label: 'MQTT' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'website', label: 'Website URL' },
  { value: 'rss', label: 'RSS Feed' },
  { value: 'api-key', label: 'API Key' },
  { value: 'kafka', label: 'Kafka' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'ftp', label: 'FTP / SFTP' },
  { value: 'grpc', label: 'gRPC' },
];

const emptyForm: ConnectorFormData = {
  name: '', type: 'rest-api', url: '',
  lat: 0, lng: 0, location: '', tags: '',
};

function formDataToPoint(form: ConnectorFormData, id?: string): IngestionPoint {
  const pointId = id || uuid().slice(0, 8);
  const config: Record<string, string> = { endpoint: form.url };

  if (form.username) config.username = form.username;
  if (form.password) config.password = '••••••';
  if (form.port) config.port = form.port;
  if (form.codec) config.codec = form.codec;
  if (form.brokerUrl) config.broker = form.brokerUrl;
  if (form.topic) config.topic = form.topic;
  if (form.qos) config.qos = form.qos;
  if (form.heartbeatInterval) config.heartbeat = form.heartbeatInterval;
  if (form.authMethod) config.authMethod = form.authMethod;
  if (form.headers) config.headers = form.headers;
  if (form.scrapeInterval) config.scrapeInterval = form.scrapeInterval;
  if (form.cssSelectors) config.cssSelectors = form.cssSelectors;
  if (form.pollInterval) config.pollInterval = form.pollInterval;

  // Derive protocol from type
  const protocolMap: Partial<Record<ConnectorType, string>> = {
    'rest-api': 'REST/HTTPS', 'connector': 'TCP/HTTPS', 'rtsp': 'RTSP/RTP',
    'hls': 'HLS',
    'mqtt': 'MQTT v5', 'websocket': 'WebSocket', 'website': 'HTTP/Scrape',
    'rss': 'RSS/XML', 'api-key': 'REST/Auth', 'kafka': 'Kafka',
    'webhook': 'HTTP/JSON', 'ftp': 'SFTP', 'grpc': 'gRPC/HTTP2',
  };

  return {
    id: pointId,
    name: form.name,
    type: form.type,
    status: 'unverified',
    lat: form.lat,
    lng: form.lng,
    location: form.location || 'Unknown',
    country: '',
    region: '',
    dataRate: '0 Mbps',
    dataRateBps: 0,
    protocol: protocolMap[form.type] || 'Unknown',
    lastSeen: 'never',
    uptime: '0.00%',
    throughput: '0 MB/s',
    errorRate: 0,
    tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    config,
    metrics: { messagesIn: 0, messagesOut: 0, bytesIn: 0, bytesOut: 0, latency: 0, errorCount: 0, reconnects: 0 },
    history: [],
    url: form.url,
  };
}

export function ConnectorsConfigView() {
  const points = useAppStore(s => s.ingestionPoints);
  const addConnector = useAppStore(s => s.addConnector);
  const removeConnector = useAppStore(s => s.removeConnector);
  const updateConnector = useAppStore(s => s.updateConnector);

  const [form, setForm] = useState<ConnectorFormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const updateField = useCallback(<K extends keyof ConnectorFormData>(key: K, value: ConnectorFormData[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;

    if (editingId) {
      const updated = formDataToPoint(form, editingId);
      updateConnector(editingId, updated);
      setEditingId(null);
    } else {
      const point = formDataToPoint(form);
      addConnector(point);
    }

    setForm(emptyForm);
    setShowForm(false);
  }, [form, editingId, addConnector, updateConnector]);

  const handleEdit = useCallback((point: IngestionPoint) => {
    setForm({
      name: point.name,
      type: point.type,
      url: point.url || point.config.endpoint || '',
      lat: point.lat,
      lng: point.lng,
      location: point.location,
      tags: point.tags.join(', '),
      username: point.config.username,
      port: point.config.port,
      codec: point.config.codec,
      brokerUrl: point.config.broker,
      topic: point.config.topic,
      qos: point.config.qos,
      heartbeatInterval: point.config.heartbeat,
      authMethod: point.config.authMethod,
      headers: point.config.headers,
      scrapeInterval: point.config.scrapeInterval,
      cssSelectors: point.config.cssSelectors,
      pollInterval: point.config.pollInterval,
    });
    setEditingId(point.id);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (confirm('Remove this connector?')) {
      removeConnector(id);
      if (editingId === id) {
        setEditingId(null);
        setShowForm(false);
        setForm(emptyForm);
      }
    }
  }, [removeConnector, editingId]);

  const handleCancel = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }, []);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Connector Configuration</h1>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) handleCancel(); }}
          className="px-4 py-2 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 transition-colors text-sm"
        >
          {showForm ? 'Cancel' : '+ Add Connector'}
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-900/30 border border-surface-800 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">{editingId ? 'Edit Connector' : 'Add New Connector'}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. NYC Financial Feed"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type *</label>
              <select
                value={form.type}
                onChange={e => updateField('type', e.target.value as ConnectorType)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                {CONNECTOR_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">URL *</label>
              <input
                type="text"
                value={form.url}
                onChange={e => updateField('url', e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                placeholder="https://api.example.com/endpoint"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={form.lat}
                onChange={e => updateField('lat', parseFloat(e.target.value) || 0)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                placeholder="40.7128"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={form.lng}
                onChange={e => updateField('lng', parseFloat(e.target.value) || 0)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                placeholder="-74.006"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => updateField('location', e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                placeholder="New York, NY"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={e => updateField('tags', e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                placeholder="production, api, financial"
              />
            </div>
          </div>

          {/* Type-specific fields */}
          {form.type === 'rtsp' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-surface-800/50 rounded-lg">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Username</label>
                <input type="text" value={form.username ?? ''} onChange={e => updateField('username', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Password</label>
                <input type="password" value={form.password ?? ''} onChange={e => updateField('password', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Port</label>
                <input type="text" value={form.port ?? ''} onChange={e => updateField('port', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" placeholder="554" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Codec</label>
                <select value={form.codec ?? ''} onChange={e => updateField('codec', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm">
                  <option value="">Default</option>
                  <option value="H.264">H.264</option>
                  <option value="H.265">H.265</option>
                </select>
              </div>
            </div>
          )}

          {form.type === 'mqtt' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-surface-800/50 rounded-lg">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Broker URL</label>
                <input type="text" value={form.brokerUrl ?? ''} onChange={e => updateField('brokerUrl', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" placeholder="mqtt://broker:8883" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Topic</label>
                <input type="text" value={form.topic ?? ''} onChange={e => updateField('topic', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" placeholder="sensors/#" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">QoS</label>
                <select value={form.qos ?? '0'} onChange={e => updateField('qos', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm">
                  <option value="0">0 - At most once</option>
                  <option value="1">1 - At least once</option>
                  <option value="2">2 - Exactly once</option>
                </select>
              </div>
            </div>
          )}

          {form.type === 'websocket' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-surface-800/50 rounded-lg">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Heartbeat Interval</label>
                <input type="text" value={form.heartbeatInterval ?? ''} onChange={e => updateField('heartbeatInterval', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" placeholder="30s" />
              </div>
            </div>
          )}

          {form.type === 'rest-api' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-3 bg-surface-800/50 rounded-lg">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Auth Method</label>
                <select value={form.authMethod ?? 'none'} onChange={e => updateField('authMethod', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm">
                  <option value="none">None</option>
                  <option value="apikey">API Key</option>
                  <option value="bearer">Bearer Token</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Custom Headers (JSON)</label>
                <input type="text" value={form.headers ?? ''} onChange={e => updateField('headers', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" placeholder='{"X-Custom": "value"}' />
              </div>
            </div>
          )}

          {form.type === 'website' && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-surface-800/50 rounded-lg">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Scrape Interval</label>
                <input type="text" value={form.scrapeInterval ?? ''} onChange={e => updateField('scrapeInterval', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" placeholder="60s" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">CSS Selectors</label>
                <input type="text" value={form.cssSelectors ?? ''} onChange={e => updateField('cssSelectors', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" placeholder=".title, .price" />
              </div>
            </div>
          )}

          {form.type === 'rss' && (
            <div className="p-3 bg-surface-800/50 rounded-lg">
              <label className="block text-xs text-gray-500 mb-1">Poll Interval</label>
              <input type="text" value={form.pollInterval ?? ''} onChange={e => updateField('pollInterval', e.target.value)} className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm" placeholder="300s" />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="submit" className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors text-sm">
              {editingId ? 'Update Connector' : 'Add Connector'}
            </button>
            <button type="button" onClick={handleCancel} className="px-4 py-2 bg-surface-800 text-gray-400 rounded-lg hover:bg-surface-700 transition-colors text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Connector list */}
      <div className="space-y-2">
        <div className="text-sm text-gray-500">{points.length} connectors configured</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-surface-800/50">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">URL</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Last Checked</th>
                <th className="text-right px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {points.map(p => (
                <tr key={p.id} className="border-b border-surface-800/30 hover:bg-surface-800/20 transition-colors">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-gray-400">{p.type}</td>
                  <td className="px-3 py-2 text-gray-400 font-mono text-xs max-w-[200px] truncate">{p.url || p.config.endpoint || '—'}</td>
                  <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {p.lastChecked ? new Date(p.lastChecked).toLocaleTimeString() : 'Never'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleEdit(p)}
                      className="px-2 py-1 text-xs text-brand-400 hover:bg-brand-500/10 rounded mr-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
