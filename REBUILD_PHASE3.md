# OverGlass Phase 3 — OSINT & Security Power Features

## New Features (5 minimum)

### Feature 1: Threat Intelligence Feed Aggregator
**Purpose**: Pull real-time threat data from public OSINT sources, correlate with monitored connectors, visualize on the map.

- **Feed sources** (all free, no API keys needed):
  - AlienVault OTX (public pulses via RSS/JSON)
  - abuse.ch (malware URLs, SSL fingerprints)
  - URLhaus (malicious URLs API — free, no key)
  - CISA Known Exploited Vulnerabilities (KEV catalog JSON)
 - Shodan InternetDB (free IP reputation API)
- **Dashboard panel**: Live threat feed ticker showing latest IOCs
- **Map integration**: Threat indicators plotted on the 2D/3D map with severity coloring (malware=red, phishing=orange, C2=red, suspicious=yellow)
- **Correlation engine**: Cross-reference threat IPs/domains with connector URLs, auto-alert when a monitored endpoint appears in threat feeds
- **Search**: Query threat feeds by IP, domain, hash, indicator type
- View: `views/ThreatIntel.tsx`

### Feature 2: Website Screenshot & Change Detection
**Purpose**: For OSINT monitoring — capture periodic screenshots of website connectors, detect visual/DOM changes, alert on modifications.

- **Implementation**:
  - For same-origin URLs: render in hidden iframe, capture via `html2canvas`
  - For cross-origin: use `<img>` with proxy (or show "cross-origin" badge and offer thumbnail via public screenshot APIs like `https://image.thum.io/get/width/1280/`)
  - **DOM diffing**: Store DOM hash (simple content hash of text content) per snapshot, compare on each interval
  - **Visual diff**: Store base64 thumbnails, allow side-by-side comparison in UI
  - **Change history**: Keep last N snapshots per connector (stored in localStorage/IndexedDB, max 10 per connector to avoid bloat)
  - **Alert on change**: When DOM hash changes, fire alert with before/after comparison
  - **View**: Per-connector screenshot history modal, global "Recent Changes" panel
- Settings per connector: capture interval (5min/15min/1hr/6hr), enable/disable change detection
- View: `views/ScreenshotHistory.tsx`, integration into `views/Video.tsx` (for website-type connectors)

### Feature 3: Alert Rules Engine
**Purpose**: User-defined automation rules — "when X happens, do Y". Core for security monitoring.

- **Rule structure**:
  ```typescript
  interface AlertRule {
    id: string;
    name: string;
    enabled: boolean;
    conditions: {
      field: 'connector.status' | 'connector.httpStatus' | 'connector.latency' | 'connector.errorRate' | 'threat.match' | 'screenshot.changed' | 'schedule';
      operator: 'equals' | 'not_equals' | 'gt' | 'lt' | 'contains' | 'changes' | 'cron';
      value: string | number;
    }[];
    actions: {
      type: 'browser_notification' | 'webhook' | 'log' | 'sound';
      config: Record<string, string>;
    }[];
    cooldown: number; // seconds between repeated triggers
    lastTriggered?: string;
  }
  ```
- **Condition types**:
  - Connector goes offline / error
  - HTTP status code is 4xx/5xx
  - Latency exceeds threshold
  - Threat intel match on monitored IP/domain
  - Website screenshot changed
  - Schedule-based (cron expression — "check every weekday at 9am")
- **Actions**:
  - Browser notification (Notification API)
  - Webhook POST (user-configured URL)
  - Sound alert (use Web Audio API for beep)
  - Log to audit trail
- **UI**: Rule builder with dropdown selectors for field/operator/value, enable/disable toggle, test button, delete
- View: `views/RulesEngine.tsx`

### Feature 4: Timeline & Evidence Vault
**Purpose**: Forensic-grade chronological event log. Every connector state change, threat match, screenshot capture, rule trigger — all logged, searchable, exportable.

- **Event types**:
  - connector.added, connector.removed, connector.status_change
  - connector.fetch_success, connector.fetch_failure
  - threat.match, threat.feed_updated
  - screenshot.captured, screenshot.change_detected
  - rule.triggered, rule.action_executed
  - alert.acknowledged
  - user.settings_changed
- **Storage**: In-memory ring buffer (last 10,000 events) + persist to IndexedDB for survival across reloads
- **UI**:
  - Vertical timeline with color-coded event types
  - Filter by: event type, connector, severity, date range, search text
  - Click event for details popup
  - Export: CSV, JSON, or copy to clipboard
  - "Jump to" navigation from alerts/threats/connectors to timeline
- **Stats bar**: Events per minute, most active connector, top event type
- View: `views/Timeline.tsx`

### Feature 5: Network Device Discovery & Inventory
**Purpose**: For home security — discover devices on the local network, track online/offline status, build an inventory.

- **Discovery methods** (browser-safe, no native deps):
  - mDNS/Bonjour discovery via multicast (experimental: `fetch('http://_http._tcp.local')` or use WebSocket to a small discovery service)
  - Simple port scan simulation: attempt `fetch()` to common device IPs (192.168.1.1-254) on port 80/443 with short timeout — devices that respond get catalogued
  - UPnP discovery via SSDP (multicast HTTP)
  - ARP table (not available from browser, but can use if a local proxy/agent exists)
- **Practical approach**: 
  - Background sweep of local subnet (192.168.x.x or user-configured range) using `fetch` with AbortController timeout
  - Responsive IPs become "discovered devices"
  - Probe common ports (80, 443, 8080, 8443, 3000, 554, 8080) to identify device type
  - User can manually add known devices
- **Device inventory**:
  - IP, hostname (from response headers if available), MAC (if accessible), last seen, open ports, device type guess (router, camera, server, IoT, unknown)
  - Online/offline tracking with heartbeat
  - Status history sparkline
- **Integration**: Discovered devices appear on the map (local area), can be added as connectors
- **Security alerts**: New device detected, known device goes offline, device type change
- View: `views/NetworkScan.tsx`

---

## Updated Architecture

```
src/
├── App.tsx
├── main.tsx
├── index.css
├── types.ts              — UPDATE: add Rule, TimelineEvent, Device, ThreatIndicator types
├── data.ts               — UPDATE: seed data as defaults
├── store.ts              — UPDATE: add rules, timeline, devices, threats to state + localStorage
├── hooks/
│   └── useShortcuts.ts
├── utils/
│   ├── analysis.ts       — UPDATE: add threat correlation
│   ├── threatFeeds.ts    — NEW: fetch & parse threat intel APIs
│   ├── screenshot.ts     — NEW: screenshot capture + DOM diff
│   ├── rulesEngine.ts    — NEW: evaluate rules against state changes
│   ├── networkScan.ts    — NEW: local network discovery
│   └── timeline.ts       — NEW: event log + IndexedDB persistence
├── components/
│   ├── ErrorBoundary.tsx
│   ├── StatusBadge.tsx
│   ├── MetricCard.tsx
│   ├── Sparkline.tsx
│   ├── ChatPanel.tsx
│   └── TimelineEventCard.tsx — NEW
└── views/
    ├── Dashboard.tsx     — UPDATE: add threat ticker, device summary
    ├── MapView.tsx       — from Phase 2
    ├── Map2D.tsx         — from Phase 2
    ├── Map3D.tsx         — from Phase 2
    ├── Connectors.tsx    — existing
    ├── ConnectorsConfig.tsx — from Phase 2
    ├── Video.tsx         — from Phase 2 (real players)
    ├── Analyst.tsx       — existing
    ├── CVAgent.tsx       — existing
    ├── Alerts.tsx        — existing
    ├── Pipeline.tsx      — existing
    ├── Terminal.tsx      — existing
    ├── Settings.tsx      — UPDATE: add rules, scan config
    ├── ThreatIntel.tsx   — NEW
    ├── ScreenshotHistory.tsx — NEW
    ├── RulesEngine.tsx   — NEW
    ├── Timeline.tsx      — NEW
    └── NetworkScan.tsx   — NEW
```

## Updated Nav Items
Add to sidebar:
- 🔍 Threat Intel (between Alerts and Pipeline)
- 📸 Screenshots (between Video and Pipeline)
- ⚡ Rules (between Pipeline and Terminal)
- 📜 Timeline (between Pipeline and Terminal)
- 🛰️ Network (between CV Agent and Alerts)

## Dependencies to Add
- `html2canvas` — for website screenshot capture
- `idb` — lightweight IndexedDB wrapper for timeline persistence
- No additional map/video deps (already added in Phase 2)

## Build Verification
Run `npm run build` after all changes. Must pass with zero errors.
Then run `npm run dev` and verify the app loads.
