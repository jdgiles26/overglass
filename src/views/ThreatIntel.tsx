/* ─── Threat Intelligence Feed Aggregator ─── */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { fetchURLhaus, fetchCISAKEV, correlateWithConnectors } from '../utils/threatFeeds';
import { MetricCard } from '../components/MetricCard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { ThreatIndicator } from '../types';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  info: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const TYPE_COLORS: Record<string, string> = {
  malware: '#ef4444',
  phishing: '#f97316',
  c2: '#dc2626',
  suspicious: '#eab308',
  ransomware: '#b91c1c',
  exploit: '#f59e0b',
  botnet: '#a855f7',
  spam: '#6b7280',
  other: '#9ca3af',
};

export function ThreatIntelView() {
  const threats = useAppStore(s => s.threats);
  const addThreats = useAppStore(s => s.addThreats);
  const clearThreats = useAppStore(s => s.clearThreats);
  const connectors = useAppStore(s => s.ingestionPoints);
  const addTimelineEvent = useAppStore(s => s.addTimelineEvent);

  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'feed' | 'correlations'>('feed');
  const [selectedThreat, setSelectedThreat] = useState<ThreatIndicator | null>(null);

  const fetchThreats = useCallback(async () => {
    setLoading(true);
    try {
      const [urlhausThreats, kevThreats] = await Promise.all([
        fetchURLhaus(),
        fetchCISAKEV(),
      ]);

      const allThreats = [...urlhausThreats, ...kevThreats];
      addThreats(allThreats);

      // Log timeline event
      const { createEvent } = await import('../utils/timeline');
      addTimelineEvent(createEvent(
        'threat.feed_updated',
        'Threat feeds updated',
        `${urlhausThreats.length} URLhaus, ${kevThreats.length} CISA KEV indicators`,
        { severity: 'info' },
      ));

      setLastFetched(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch threats:', err);
    }
    setLoading(false);
  }, [addThreats, addTimelineEvent]);

  // Auto-fetch on mount
  useEffect(() => {
    if (threats.length === 0) {
      fetchThreats();
    }
  }, []);

  // Compute correlations
  const correlations = correlateWithConnectors(threats, connectors);

  // Filter threats
  const filteredThreats = threats.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterSeverity !== 'all' && t.severity !== filterSeverity) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.url.toLowerCase().includes(q) ||
        t.host.toLowerCase().includes(q) ||
        t.threat.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueTypes = [...new Set(threats.map(t => t.type))];
  const countsBySeverity = {
    critical: threats.filter(t => t.severity === 'critical').length,
    high: threats.filter(t => t.severity === 'high').length,
    medium: threats.filter(t => t.severity === 'medium').length,
    low: threats.filter(t => t.severity === 'low').length,
    info: threats.filter(t => t.severity === 'info').length,
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🔍 Threat Intelligence</h1>
          <p className="text-xs text-gray-500 mt-1">
            OSINT feeds from URLhaus, CISA KEV, and Shodan InternetDB
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchThreats}
            disabled={loading}
            className="px-4 py-2 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 text-sm disabled:opacity-50"
          >
            {loading ? '⏳ Fetching...' : '🔄 Refresh'}
          </button>
          <button
            onClick={() => { if (confirm('Clear all threat data?')) clearThreats(); }}
            className="px-4 py-2 bg-surface-800 text-gray-400 rounded-lg hover:bg-surface-700 text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {lastFetched && (
        <div className="text-xs text-gray-600">Last fetched: {lastFetched}</div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard label="Total IOCs" value={threats.length} />
        <MetricCard label="Critical" value={countsBySeverity.critical} />
        <MetricCard label="High" value={countsBySeverity.high} />
        <MetricCard label="Medium" value={countsBySeverity.medium} />
        <MetricCard label="Correlations" value={correlations.length} />
        <MetricCard label="Sources" value="3" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-800 pb-2">
        <button
          onClick={() => setActiveTab('feed')}
          className={`px-4 py-2 text-sm rounded-t-lg ${activeTab === 'feed' ? 'bg-brand-500/10 text-brand-400 border border-b-0 border-brand-500/30' : 'text-gray-500 hover:text-gray-300'}`}
        >
          📡 Threat Feed ({threats.length})
        </button>
        <button
          onClick={() => setActiveTab('correlations')}
          className={`px-4 py-2 text-sm rounded-t-lg ${activeTab === 'correlations' ? 'bg-brand-500/10 text-brand-400 border border-b-0 border-brand-500/30' : 'text-gray-500 hover:text-gray-300'}`}
        >
          🚨 Correlations ({correlations.length})
        </button>
      </div>

      {activeTab === 'feed' && (
        <ErrorBoundary>
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by URL, host, threat..."
                className="flex-1 min-w-[200px] bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                {uniqueTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Threat list */}
            <div className="space-y-1 max-h-[calc(100vh-360px)] overflow-y-auto">
              {filteredThreats.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  {loading ? 'Fetching threat data...' : 'No threats match filters'}
                </div>
              )}
              {filteredThreats.slice(0, 100).map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedThreat(selectedThreat?.id === t.id ? null : t)}
                  className={`w-full text-left bg-surface-900/30 border border-surface-800 rounded-lg p-3 hover:bg-surface-800/50 transition-colors ${
                    selectedThreat?.id === t.id ? 'border-brand-500/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: TYPE_COLORS[t.type] || '#9ca3af' }}
                    />
                    <span className="text-sm font-medium truncate flex-1">{t.host || t.url}</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full border ${SEVERITY_COLORS[t.severity]}`}>
                      {t.severity}
                    </span>
                    <span className="text-[10px] text-gray-500">{t.source}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{t.description}</div>
                  {selectedThreat?.id === t.id && (
                    <div className="mt-2 pt-2 border-t border-surface-800 text-xs text-gray-400 grid grid-cols-2 gap-1">
                      <div><span className="text-gray-500">URL:</span> {t.url}</div>
                      <div><span className="text-gray-500">Host:</span> {t.host}</div>
                      <div><span className="text-gray-500">Type:</span> {t.type}</div>
                      <div><span className="text-gray-500">Date:</span> {t.date}</div>
                      {t.tags.length > 0 && (
                        <div className="col-span-2"><span className="text-gray-500">Tags:</span> {t.tags.join(', ')}</div>
                      )}
                    </div>
                  )}
                </button>
              ))}
              {filteredThreats.length > 100 && (
                <div className="text-center text-gray-500 text-xs py-2">
                  Showing 100 of {filteredThreats.length} threats. Use search to narrow results.
                </div>
              )}
            </div>
          </div>
        </ErrorBoundary>
      )}

      {activeTab === 'correlations' && (
        <div className="space-y-2">
          {correlations.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {threats.length === 0 ? 'Fetch threats first, then correlations will appear here.' : 'No correlations found between threats and your connectors.'}
            </div>
          ) : (
            correlations.map(({ threat, connectorId, connectorName }) => (
              <div key={`${threat.id}-${connectorId}`} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-red-400">🚨</span>
                  <span className="font-semibold text-sm text-red-400">MATCH</span>
                  <span className="text-xs text-gray-500">→ {connectorName}</span>
                </div>
                <div className="text-xs text-gray-400">
                  <div>{threat.url}</div>
                  <div className="text-gray-500">{threat.threat} · {threat.source} · {threat.date}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
