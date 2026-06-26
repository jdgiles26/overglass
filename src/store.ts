/* ─── Zustand store with localStorage persistence and real data refresh ─── */
import { create } from 'zustand';
import type { AppState, ViewId, ChatMessage, CVTask, IngestionPoint, TimelineEvent, AlertRule, ThreatIndicator, ScreenshotRecord, DiscoveredDevice } from './types';
import { defaultIngestionPoints, defaultVideoFeeds, pipeline, computeAlerts } from './data';
import { createEvent, persistEvent, loadEventsFromDB, timelineBuffer, clearEventsDB } from './utils/timeline';
import { evaluateRule, executeRuleActions } from './utils/rulesEngine';

/* ─── localStorage helpers ─── */
const STORAGE_KEY = 'overglass-connectors';
const SETTINGS_KEY = 'overglass-settings';
const RULES_KEY = 'overglass-rules';
const DEVICES_KEY = 'overglass-devices';
const SCREENSHOTS_KEY = 'overglass-screenshots';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

function loadConnectors(): IngestionPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultIngestionPoints.map(p => ({ ...p }));
    const stored: IngestionPoint[] = JSON.parse(raw);
    const storedMap = new Map(stored.map(p => [p.id, p]));
    const merged = defaultIngestionPoints.map(d => storedMap.get(d.id) ?? { ...d });
    const defaultIds = new Set(defaultIngestionPoints.map(d => d.id));
    for (const s of stored) {
      if (!defaultIds.has(s.id)) merged.push(s);
    }
    return merged;
  } catch {
    return defaultIngestionPoints.map(p => ({ ...p }));
  }
}

function saveConnectors(connectors: IngestionPoint[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(connectors)); } catch { /* ignore */ }
}

function loadSettings(): Partial<AppState['settings']> | undefined {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return undefined;
}

function saveSettings(settings: AppState['settings']) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

/* ─── Real connector verification ─── */
async function verifyConnector(connector: IngestionPoint): Promise<Partial<IngestionPoint>> {
  const url = connector.url || connector.config.endpoint || connector.config.url || '';
  if (!url) return { status: 'unverified' as const };
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { status: 'unverified' as const };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const start = performance.now();
    const res = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    const elapsed = Math.round(performance.now() - start);
    clearTimeout(timeout);

    return {
      status: 'active' as const,
      lastChecked: new Date().toISOString(),
      responseTime: elapsed,
      httpStatus: res.status || 200,
      lastSeen: 'just now',
      uptime: '100.00%',
      metrics: {
        messagesIn: connector.metrics.messagesIn,
        messagesOut: connector.metrics.messagesOut,
        bytesIn: connector.metrics.bytesIn,
        bytesOut: connector.metrics.bytesOut,
        latency: elapsed,
        errorCount: connector.metrics.errorCount,
        reconnects: connector.metrics.reconnects,
      },
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        status: 'error' as const,
        lastChecked: new Date().toISOString(),
        responseTime: 5000,
        httpStatus: 0,
        lastSeen: 'timeout',
      };
    }
    return {
      status: 'error' as const,
      lastChecked: new Date().toISOString(),
      httpStatus: 0,
      lastSeen: 'unreachable',
    };
  }
}

/* ─── RSS parser ─── */
export function parseRSS(xmlText: string): { title: string; items: { title: string; link: string; pubDate?: string }[] } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const channel = doc.querySelector('channel');
    if (!channel) return { title: '', items: [] };
    const title = channel.querySelector('title')?.textContent ?? '';
    const items = Array.from(channel.querySelectorAll('item')).map(item => ({
      title: item.querySelector('title')?.textContent ?? '',
      link: item.querySelector('link')?.textContent ?? '',
      pubDate: item.querySelector('pubDate')?.textContent ?? undefined,
    }));
    return { title, items };
  } catch {
    return { title: '', items: [] };
  }
}

/* ─── Store ─── */
const initialConnectors = loadConnectors();
const savedSettings = loadSettings();
const initialAlerts = computeAlerts(initialConnectors, defaultVideoFeeds);

// Load Phase 3 data
const initialRules: AlertRule[] = loadJSON(RULES_KEY, []);
const initialDevices: DiscoveredDevice[] = loadJSON(DEVICES_KEY, []);
const initialScreenshots: ScreenshotRecord[] = loadJSON(SCREENSHOTS_KEY, []);

export const useAppStore = create<AppState>()((set, get) => ({
  activeView: 'dashboard',
  ingestionPoints: initialConnectors,
  videoFeeds: defaultVideoFeeds.map(f => ({ ...f })),
  alerts: initialAlerts,
  pipeline: pipeline.map(p => ({ ...p })),
  chatMessages: [
    { id: 'init', role: 'assistant', content: 'OverGlass Data Fabric — type a command or ask about any connector, feed, or metric.', timestamp: new Date().toISOString() }
  ],
  cvTasks: [],
  showChat: false,
  showAlerts: false,
  globeMode: true,
  settings: {
    autoRefresh: savedSettings?.autoRefresh ?? true,
    refreshInterval: savedSettings?.refreshInterval ?? 10000,
    showVideoMarkers: savedSettings?.showVideoMarkers ?? true,
    theme: savedSettings?.theme ?? 'dark',
    mapView: savedSettings?.mapView ?? '2d',
    networkSubnet: savedSettings?.networkSubnet ?? '192.168.1.0/24',
    networkScanInterval: savedSettings?.networkScanInterval ?? 300000,
    networkScanEnabled: savedSettings?.networkScanEnabled ?? false,
    screenshotServiceUrl: savedSettings?.screenshotServiceUrl ?? 'https://image.thum.io/get/width/1280/',
  },

  /* Phase 3 state */
  threats: [],
  screenshots: initialScreenshots,
  rules: initialRules,
  timeline: [],
  devices: initialDevices,

  setActiveView: (v: ViewId) => set({ activeView: v }),
  toggleChat: () => set(s => ({ showChat: !s.showChat })),
  toggleAlerts: () => set(s => ({ showAlerts: !s.showAlerts })),
  toggleGlobeMode: () => set(s => ({ globeMode: !s.globeMode })),

  addChatMessage: (msg: ChatMessage) => set(s => ({ chatMessages: [...s.chatMessages, msg] })),

  addCVTask: (task: CVTask) => set(s => ({ cvTasks: [...s.cvTasks, task] })),
  updateCVTask: (id: string, updates: Partial<CVTask>) => set(s => ({
    cvTasks: s.cvTasks.map(t => t.id === id ? { ...t, ...updates } : t)
  })),

  acknowledgeAlert: (id: string) => set(s => ({
    alerts: s.alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a)
  })),
  clearAcknowledged: () => set(s => ({
    alerts: s.alerts.filter(a => !a.acknowledged)
  })),

  setSetting: (key, value) => {
    const newSettings = { ...get().settings, [key]: value };
    saveSettings(newSettings);
    set({ settings: newSettings as AppState['settings'] });
    // Log settings change
    const event = createEvent('user.settings_changed', `Setting changed`, `${String(key)} = ${String(value)}`, { severity: 'info' });
    get().addTimelineEvent(event);
  },

  addConnector: (connector: IngestionPoint) => {
    const newConnectors = [...get().ingestionPoints, connector];
    saveConnectors(newConnectors);
    set(s => ({
      ingestionPoints: newConnectors,
      alerts: computeAlerts(newConnectors, s.videoFeeds),
    }));
    const event = createEvent('connector.added', `Connector added: ${connector.name}`, `${connector.type} at ${connector.url ?? 'unknown'}`, {
      severity: 'info',
      connectorId: connector.id,
      connectorName: connector.name,
    });
    get().addTimelineEvent(event);
  },

  removeConnector: (id: string) => {
    const connector = get().ingestionPoints.find(p => p.id === id);
    const newConnectors = get().ingestionPoints.filter(p => p.id !== id);
    saveConnectors(newConnectors);
    set(s => ({
      ingestionPoints: newConnectors,
      alerts: computeAlerts(newConnectors, s.videoFeeds),
    }));
    if (connector) {
      const event = createEvent('connector.removed', `Connector removed: ${connector.name}`, `${connector.type} at ${connector.url ?? 'unknown'}`, {
        severity: 'warning',
        connectorId: id,
        connectorName: connector.name,
      });
      get().addTimelineEvent(event);
    }
  },

  updateConnector: (id: string, updates: Partial<IngestionPoint>) => {
    const old = get().ingestionPoints.find(p => p.id === id);
    const newConnectors = get().ingestionPoints.map(p =>
      p.id === id ? { ...p, ...updates } : p
    );
    saveConnectors(newConnectors);
    set(s => ({
      ingestionPoints: newConnectors,
      alerts: computeAlerts(newConnectors, s.videoFeeds),
    }));
    if (old && updates.status && updates.status !== old.status) {
      const event = createEvent('connector.status_change', `${old.name}: ${old.status} → ${updates.status}`, `HTTP ${updates.httpStatus ?? '?'} | ${updates.responseTime ?? '?'}ms`, {
        severity: updates.status === 'error' ? 'critical' : 'info',
        connectorId: id,
        connectorName: old.name,
      });
      get().addTimelineEvent(event);
    }
  },

  resetToDefaults: () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(RULES_KEY);
    localStorage.removeItem(DEVICES_KEY);
    localStorage.removeItem(SCREENSHOTS_KEY);
    clearEventsDB();
    const defaults = defaultIngestionPoints.map(p => ({ ...p }));
    saveConnectors(defaults);
    timelineBuffer.clear();
    set({
      ingestionPoints: defaults,
      alerts: computeAlerts(defaults, defaultVideoFeeds),
      rules: [],
      devices: [],
      screenshots: [],
      timeline: [],
      threats: [],
      settings: {
        autoRefresh: true,
        refreshInterval: 10000,
        showVideoMarkers: true,
        theme: 'dark',
        mapView: '2d',
        networkSubnet: '192.168.1.0/24',
        networkScanInterval: 300000,
        networkScanEnabled: false,
        screenshotServiceUrl: 'https://image.thum.io/get/width/1280/',
      },
    });
  },

  /* Phase 3 actions */
  addThreats: (threats: ThreatIndicator[]) => set(s => {
    const existing = new Set(s.threats.map(t => t.id));
    const newThreats = threats.filter(t => !existing.has(t.id));
    return { threats: [...newThreats, ...s.threats].slice(0, 500) };
  }),

  clearThreats: () => set({ threats: [] }),

  addScreenshot: (screenshot: ScreenshotRecord) => {
    const updated = [...get().screenshots, screenshot];
    // Keep last 10 per connector
    const counts = new Map<string, number>();
    const filtered: ScreenshotRecord[] = [];
    for (let i = updated.length - 1; i >= 0; i--) {
      const cId = updated[i].connectorId;
      const count = counts.get(cId) ?? 0;
      if (count < 10) {
        filtered.unshift(updated[i]);
        counts.set(cId, count + 1);
      }
    }
    saveJSON(SCREENSHOTS_KEY, filtered);
    set({ screenshots: filtered });
  },

  removeScreenshotsForConnector: (connectorId: string) => {
    const filtered = get().screenshots.filter(s => s.connectorId !== connectorId);
    saveJSON(SCREENSHOTS_KEY, filtered);
    set({ screenshots: filtered });
  },

  addRule: (rule: AlertRule) => {
    const updated = [...get().rules, rule];
    saveJSON(RULES_KEY, updated);
    set({ rules: updated });
  },

  updateRule: (id: string, updates: Partial<AlertRule>) => {
    const updated = get().rules.map(r => r.id === id ? { ...r, ...updates } : r);
    saveJSON(RULES_KEY, updated);
    set({ rules: updated });
  },

  removeRule: (id: string) => {
    const updated = get().rules.filter(r => r.id !== id);
    saveJSON(RULES_KEY, updated);
    set({ rules: updated });
  },

  triggerRule: async (ruleId: string, event: TimelineEvent) => {
    const rule = get().rules.find(r => r.id === ruleId);
    if (!rule) return;

    const results = await executeRuleActions(rule.actions, rule.name, event.description);
    const now = new Date().toISOString();

    // Update last triggered
    get().updateRule(ruleId, { lastTriggered: now });

    // Log action execution
    const actionEvent = createEvent('rule.action_executed', `Rule action: ${rule.name}`, results.join(', '), {
      severity: 'warning',
      connectorId: event.connectorId,
      connectorName: event.connectorName,
      metadata: { ruleId, results: results.join('; ') },
    });
    get().addTimelineEvent(actionEvent);
  },

  addTimelineEvent: (event: TimelineEvent) => {
    const updated = timelineBuffer.push(event);
    persistEvent(event);
    set({ timeline: updated });

    // Check rules against this event
    const state = get();
    for (const rule of state.rules) {
      const connector = event.connectorId
        ? state.ingestionPoints.find(p => p.id === event.connectorId)
        : undefined;

      const matched = evaluateRule(rule, {
        connector,
        threatMatch: event.type === 'threat.match',
        screenshotChanged: event.type === 'screenshot.change_detected',
      });

      if (matched) {
        const triggerEvent = createEvent('rule.triggered', `Rule triggered: ${rule.name}`, event.description, {
          severity: event.severity,
          connectorId: event.connectorId,
          connectorName: event.connectorName,
          metadata: { ruleId: rule.id },
        });
        state.addTimelineEvent(triggerEvent);
        // Execute actions async
        state.triggerRule(rule.id, triggerEvent);
      }
    }
  },

  addDevice: (device: DiscoveredDevice) => {
    const existing = get().devices.find(d => d.ip === device.ip);
    if (existing) {
      // Update existing device
      get().updateDevice(existing.id, {
        lastSeen: device.lastSeen,
        status: device.status,
        previousStatus: existing.status,
        openPorts: device.openPorts.length > existing.openPorts.length ? device.openPorts : existing.openPorts,
      });
      return;
    }
    const updated = [...get().devices, device];
    saveJSON(DEVICES_KEY, updated);
    set({ devices: updated });
    const event = createEvent('device.discovered', `Device discovered: ${device.ip}`, `${device.deviceType} — ports: ${device.openPorts.join(', ')}`, {
      severity: 'info',
      metadata: { ip: device.ip, deviceType: device.deviceType },
    });
    get().addTimelineEvent(event);
  },

  updateDevice: (id: string, updates: Partial<DiscoveredDevice>) => {
    const old = get().devices.find(d => d.id === id);
    const updated = get().devices.map(d => d.id === id ? { ...d, ...updates } : d);
    saveJSON(DEVICES_KEY, updated);
    set({ devices: updated });

    if (old && updates.status && updates.status !== old.status) {
      const eventType = updates.status === 'online' ? 'device.online' : 'device.offline';
      const event = createEvent(eventType, `Device ${updates.status}: ${old.ip}`, `${old.deviceType} was ${old.status}`, {
        severity: updates.status === 'offline' ? 'warning' : 'info',
        metadata: { ip: old.ip },
      });
      get().addTimelineEvent(event);
    }
  },

  removeDevice: (id: string) => {
    const updated = get().devices.filter(d => d.id !== id);
    saveJSON(DEVICES_KEY, updated);
    set({ devices: updated });
  },

  exportTimeline: (format: 'json' | 'csv') => {
    const events = get().timeline;
    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }
    const headers = ['id', 'type', 'timestamp', 'title', 'description', 'severity', 'connectorId', 'connectorName'];
    const rows = events.map(e =>
      headers.map(h => JSON.stringify(e[h as keyof TimelineEvent] ?? '')).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  },

  /* Real refresh — actually fetch connector URLs */
  refreshData: () => {
    const state = get();
    const points = state.ingestionPoints;

    const promises = points.map(async (p): Promise<IngestionPoint> => {
      const updates = await verifyConnector(p);
      const updated = { ...p, ...updates };
      if (updates.responseTime !== undefined) {
        const latency = updated.metrics.latency;
        const newMetrics = { ...updated.metrics, latency };
        const newHistory = [...(updated.history || []).slice(-59), newMetrics];
        return { ...updated, metrics: newMetrics, history: newHistory };
      }
      return updated;
    });

    Promise.all(promises).then(updatedPoints => {
      const oldPoints = get().ingestionPoints;
      const oldMap = new Map(oldPoints.map(p => [p.id, p.status]));

      saveConnectors(updatedPoints);
      set(s => ({
        ingestionPoints: updatedPoints,
        alerts: computeAlerts(updatedPoints, s.videoFeeds),
      }));

      // Log status changes
      for (const p of updatedPoints) {
        const oldStatus = oldMap.get(p.id);
        if (oldStatus && p.status !== oldStatus) {
          const sev = p.status === 'error' ? 'critical' : 'info';
          const event = createEvent(
            'connector.status_change',
            `${p.name}: ${oldStatus} → ${p.status}`,
            `HTTP ${p.httpStatus ?? '?'} | ${p.responseTime ?? '?'}ms`,
            { severity: sev, connectorId: p.id, connectorName: p.name },
          );
          get().addTimelineEvent(event);
        }
      }
    }).catch(() => { /* ignore */ });
  },
}));
