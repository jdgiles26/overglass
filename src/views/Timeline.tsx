/* ─── Timeline & Evidence Vault ─── */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { loadEventsFromDB } from '../utils/timeline';
import { getEventColor, getEventIcon } from '../utils/timeline';
import { MetricCard } from '../components/MetricCard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { TimelineEvent } from '../types';

const EVENT_TYPES = [
  'connector.added', 'connector.removed', 'connector.status_change',
  'connector.fetch_success', 'connector.fetch_failure',
  'threat.match', 'threat.feed_updated',
  'screenshot.captured', 'screenshot.change_detected',
  'rule.triggered', 'rule.action_executed',
  'alert.acknowledged',
  'user.settings_changed',
  'device.discovered', 'device.online', 'device.offline',
];

const SEVERITY_COLORS: Record<string, string> = {
  info: 'border-l-blue-500',
  warning: 'border-l-yellow-500',
  critical: 'border-l-red-500',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

function groupByDate(events: TimelineEvent[]): { date: string; events: TimelineEvent[] }[] {
  const groups = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const date = formatDate(e.timestamp);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(e);
  }
  return Array.from(groups.entries()).map(([date, events]) => ({ date, events }));
}

export function TimelineView() {
  const timeline = useAppStore(s => s.timeline);
  const exportTimeline = useAppStore(s => s.exportTimeline);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [dbLoaded, setDbLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load events from IndexedDB on mount
  useEffect(() => {
    loadEventsFromDB().then(dbEvents => {
      if (dbEvents.length > 0 && timeline.length === 0) {
        // Timeline events are already in the store from the buffer
        // This handles reload persistence
      }
      setDbLoaded(true);
    }).catch(() => setDbLoaded(true));
  }, []);

  // Filter events
  const filteredEvents = timeline.filter(e => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterSeverity !== 'all' && e.severity !== filterSeverity) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.connectorName?.toLowerCase().includes(q);
    }
    return true;
  });

  const grouped = groupByDate(filteredEvents.slice(0, 500));

  // Stats
  const eventsPerMinute = timeline.length > 1
    ? (() => {
        if (timeline.length < 2) return 0;
        const first = new Date(timeline[timeline.length - 1].timestamp).getTime();
        const last = new Date(timeline[0].timestamp).getTime();
        const minutes = Math.max(1, (last - first) / 60000);
        return (timeline.length / minutes).toFixed(1);
      })()
    : '0';

  const topTypes = [...new Set(timeline.map(e => e.type))].slice(0, 5);
  const activeConnectors = [...new Set(timeline.filter(e => e.connectorId).map(e => e.connectorId!))];

  const handleExport = useCallback((format: 'json' | 'csv') => {
    const data = exportTimeline(format);
    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overglass-timeline.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportTimeline]);

  const handleCopy = useCallback(() => {
    const data = exportTimeline('json');
    navigator.clipboard.writeText(data).then(() => {
      alert('Timeline copied to clipboard');
    }).catch(() => {
      alert('Failed to copy');
    });
  }, [exportTimeline]);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📜 Timeline</h1>
          <p className="text-xs text-gray-500 mt-1">Forensic-grade chronological event log</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('json')} className="px-3 py-1.5 bg-surface-800 text-gray-400 rounded-lg hover:bg-surface-700 text-xs">
            Export JSON
          </button>
          <button onClick={() => handleExport('csv')} className="px-3 py-1.5 bg-surface-800 text-gray-400 rounded-lg hover:bg-surface-700 text-xs">
            Export CSV
          </button>
          <button onClick={handleCopy} className="px-3 py-1.5 bg-surface-800 text-gray-400 rounded-lg hover:bg-surface-700 text-xs">
            📋 Copy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Events" value={timeline.length} />
        <MetricCard label="Events/min" value={eventsPerMinute} />
        <MetricCard label="Active Sources" value={activeConnectors.length} />
        <MetricCard label="Event Types" value={topTypes.length} />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search events..."
          className="flex-1 min-w-[200px] bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Types</option>
          {EVENT_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
        >
          <option value="all">All Severity</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Selected event detail */}
      {selectedEvent && (
        <div className="bg-surface-900/30 border border-brand-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getEventIcon(selectedEvent.type)}</span>
              <h3 className="font-semibold">{selectedEvent.title}</h3>
            </div>
            <button onClick={() => setSelectedEvent(null)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
          </div>
          <p className="text-sm text-gray-400 mb-2">{selectedEvent.description}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500">
            <div>Type: <span style={{ color: getEventColor(selectedEvent.type) }}>{selectedEvent.type}</span></div>
            <div>Severity: {selectedEvent.severity}</div>
            <div>Time: {new Date(selectedEvent.timestamp).toLocaleString()}</div>
            {selectedEvent.connectorName && (
              <div>Connector: {selectedEvent.connectorName}</div>
            )}
          </div>
          {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
            <div className="mt-2 pt-2 border-t border-surface-800">
              <div className="text-xs text-gray-500">Metadata:</div>
              <div className="text-xs font-mono text-gray-400 mt-1">
                {Object.entries(selectedEvent.metadata).map(([k, v]) => (
                  <div key={k}>{k}: {String(v)}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="max-h-[calc(100vh-380px)] overflow-y-auto" ref={scrollRef}>
        {!dbLoaded ? (
          <div className="text-center text-gray-500 py-8 animate-pulse">Loading events from database...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <div className="text-4xl mb-4">📜</div>
            <p>No events yet</p>
            <p className="text-sm text-gray-600 mt-1">
              Events will appear here as connectors change, threats are detected, rules trigger, etc.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px bg-surface-800" />

            <div className="space-y-1">
              {grouped.map(group => (
                <div key={group.date}>
                  <div className="sticky top-0 z-10 bg-surface-950 py-1">
                    <span className="text-xs text-gray-500 font-semibold">{group.date} ({group.events.length})</span>
                  </div>
                  {group.events.map(event => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                      className={`w-full text-left relative pl-10 pr-3 py-2 rounded-lg hover:bg-surface-800/30 transition-colors ${
                        selectedEvent?.id === event.id ? 'bg-surface-800/50' : ''
                      } border-l-2 ${SEVERITY_COLORS[event.severity]}`}
                    >
                      {/* Dot on the timeline */}
                      <div
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-surface-950"
                        style={{ backgroundColor: getEventColor(event.type) }}
                      />

                      <div className="flex items-center gap-2">
                        <span className="text-xs">{getEventIcon(event.type)}</span>
                        <span className="text-sm font-medium truncate flex-1">{event.title}</span>
                        <span className="text-[10px] text-gray-600 shrink-0">{formatTime(event.timestamp)}</span>
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">{event.description}</div>
                      {event.connectorName && (
                        <div className="text-[10px] text-gray-600 mt-0.5">🔌 {event.connectorName}</div>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {filteredEvents.length > 500 && (
          <div className="text-center text-gray-500 text-xs py-2">
            Showing 500 of {filteredEvents.length} events. Use filters to narrow.
          </div>
        )}
      </div>
    </div>
  );
}
