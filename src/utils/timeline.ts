/* ─── Timeline: Ring buffer + IndexedDB persistence ─── */
import type { TimelineEvent } from '../types';
import { openDB } from 'idb';

const DB_NAME = 'overglass-timeline';
const DB_VERSION = 1;
const STORE_NAME = 'events';
const MAX_EVENTS = 10000;

let dbPromise: ReturnType<typeof openDB> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('connectorId', 'connectorId', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

/* In-memory ring buffer */
class TimelineBuffer {
  private buffer: TimelineEvent[] = [];
  private listeners: Array<() => void> = [];

  push(event: TimelineEvent): TimelineEvent[] {
    this.buffer.push(event);
    if (this.buffer.length > MAX_EVENTS) {
      this.buffer = this.buffer.slice(-MAX_EVENTS);
    }
    this.notify();
    return [...this.buffer];
  }

  getAll(): TimelineEvent[] {
    return [...this.buffer];
  }

  clear() {
    this.buffer = [];
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}

export const timelineBuffer = new TimelineBuffer();

/* Persist an event to IndexedDB */
export async function persistEvent(event: TimelineEvent): Promise<void> {
  try {
    const db = await getDB();
    if (db) await db.put(STORE_NAME, event);
  } catch {
    // IndexedDB not available — events stay in memory only
  }
}

/* Load all events from IndexedDB */
export async function loadEventsFromDB(): Promise<TimelineEvent[]> {
  try {
    const db = await getDB();
    if (!db) return [];
    const events = await db.getAll(STORE_NAME);
    return (events as TimelineEvent[]).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

/* Clear all events from IndexedDB */
export async function clearEventsDB(): Promise<void> {
  try {
    const db = await getDB();
    if (db) await db.clear(STORE_NAME);
  } catch {
    // ignore
  }
}

/* Create a timeline event */
export function createEvent(
  type: TimelineEvent['type'],
  title: string,
  description: string,
  options?: {
    severity?: TimelineEvent['severity'];
    connectorId?: string;
    connectorName?: string;
    metadata?: Record<string, string | number | boolean>;
  },
): TimelineEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: new Date().toISOString(),
    title,
    description,
    severity: options?.severity ?? 'info',
    connectorId: options?.connectorId,
    connectorName: options?.connectorName,
    metadata: options?.metadata,
  };
}

/* Export events to JSON */
export function exportToJSON(events: TimelineEvent[]): string {
  return JSON.stringify(events, null, 2);
}

/* Export events to CSV */
export function exportToCSV(events: TimelineEvent[]): string {
  const headers = ['id', 'type', 'timestamp', 'title', 'description', 'severity', 'connectorId', 'connectorName'];
  const rows = events.map(e =>
    headers.map(h => JSON.stringify(e[h as keyof TimelineEvent] ?? '')).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/* Event type color mapping */
export function getEventColor(type: TimelineEvent['type']): string {
  if (type.startsWith('connector.')) return '#6366f1'; // indigo
  if (type.startsWith('threat.')) return '#ef4444'; // red
  if (type.startsWith('screenshot.')) return '#22c55e'; // green
  if (type.startsWith('rule.')) return '#f59e0b'; // yellow
  if (type.startsWith('alert.')) return '#ec4899'; // pink
  if (type.startsWith('user.')) return '#3b82f6'; // blue
  if (type.startsWith('device.')) return '#06b6d4'; // cyan
  return '#6b7280'; // gray
}

/* Event type icon mapping */
export function getEventIcon(type: TimelineEvent['type']): string {
  if (type === 'connector.added') return '🔌';
  if (type === 'connector.removed') return '🗑️';
  if (type === 'connector.status_change') return '🔄';
  if (type === 'connector.fetch_success') return '✅';
  if (type === 'connector.fetch_failure') return '❌';
  if (type === 'threat.match') return '🚨';
  if (type === 'threat.feed_updated') return '📡';
  if (type === 'screenshot.captured') return '📸';
  if (type === 'screenshot.change_detected') return '🔍';
  if (type === 'rule.triggered') return '⚡';
  if (type === 'rule.action_executed') return '🔧';
  if (type === 'alert.acknowledged') return '👀';
  if (type === 'user.settings_changed') return '⚙️';
  if (type === 'device.discovered') return '🛰️';
  if (type === 'device.online') return '🟢';
  if (type === 'device.offline') return '🔴';
  return '📌';
}
