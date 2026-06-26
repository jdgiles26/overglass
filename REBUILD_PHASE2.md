# OverGlass Phase 2 — Production Rebuild

## Goal
Transform OverGlass from a demo with static data into a production-ready real-time data fabric with live connectors, real video playback, and a proper 3D/2D globe.

## Reference Architecture (from attached files)
The attached Map3D.tsx (Cesium) / Map2D.tsx (MapLibre GL) / MapView.tsx pattern is the target globe architecture:
- **Map2D**: MapLibre GL with dark OSM tiles, heatmap layer + circle markers, fly-to support, real-time GeoJSON source updates
- **Map3D**: Cesium JS with OSM imagery, entity management (add/remove/update), camera follow, click selection
- **MapView**: Toggle between 2D, 3D, and split view, dynamic imports
- **Adapt this pattern** for OverGlass connector nodes instead of events

## Requirements

### 1. Globe/Map (Rewrite views/Globe.tsx)
- Install `maplibre-gl` and `cesium` (peer dep)
- Create `views/Map2D.tsx` — MapLibre GL dark map showing connector nodes as circle markers colored by status (green=active, red=error, yellow=connecting, gray=inactive). Click a node to select it and show details.
- Create `views/Map3D.tsx` — Cesium 3D globe with the same data, entity sync, fly-to on node click
- Create `views/MapView.tsx` — toggle between 2D/3D/split (store the map mode in settings)
- Nodes update in real time as connectors are added/removed/status changes
- Store `mapView: '2d' | '3d' | 'split'` in settings

### 2. Connector Configuration Page (NEW views/ConnectorsConfig.tsx)
- Form to add new connectors:
  - **Connector types**: RTSP, HTTP/HTTPS stream, m3u8/HLS, IP camera, MQTT, WebSocket, REST API, Website URL, RSS feed
  - **Common fields**: Name, URL, Type, Location (lat/lng or searchable), Tags
  - **Type-specific fields**: 
    - RTSP/IP Camera: username, password, port, codec preference
    - m3u8/HLS: just URL
    - MQTT: broker URL, topic, QoS, username, password
    - WebSocket: URL, heartbeat interval
    - REST API: endpoint, auth method (none/apikey/bearer), headers
    - Website URL: scrape interval, CSS selectors for data extraction
    - RSS feed: URL, poll interval
- Each connector in the list gets a **Delete** button and **Edit** button
- Connectors are persisted to localStorage (key: `overglass-connectors`)
- On app load, merge localStorage connectors with the seed data (seed data is defaults, user additions override)
- New connectors immediately appear on the map with status "connecting" until proven otherwise

### 3. Real Video Players (Rewrite views/Video.tsx)
- Install `vidstack` (or `@vidstack/react` + `@vidstack/player`)
- For each video connector that has a URL:
  - RTSP → attempt via HLS proxy or show "RTSP requires proxy" with config option
  - m3u8/HLS → native HLS playback via vidstack
  - HTTP/HTTPS MP4/WebM → native playback via vidstack
  - YouTube/embed URLs → iframe embed
  - Website URLs → iframe embed option
- Video grid with real players, not placeholder gray boxes
- Each feed card has: play/pause, fullscreen, delete, settings controls
- Use the `type` field to determine player strategy
- Show "No player available" only for types that truly can't play (raw RTSP without proxy, MQTT, etc.)

### 4. Dashboard with Real Data (Update views/Dashboard.tsx)
- Stop simulating metric jitter — use actual data from connectors
- Show real connection status per connector (attempt to ping/connect and report status)
- For connectors that are real URLs (HTTP/HTTPS, website, RSS), show last fetch time and response status
- For video connectors, show player status (playing/stopped/error)
- Aggregate stats computed from actual connector states, not random numbers

### 5. Remove All Mock/Simulated Data
- `data.ts`: Keep the seed data as **defaults** but mark them clearly as demo defaults
- `store.ts`: Remove the `refreshData()` function that adds random jitter to metrics
- Instead, `refreshData()` should attempt to **actually fetch** from connector URLs and update status accordingly
  - HTTP/HTTPS connectors: fetch the URL, report HTTP status code, response time
  - Website scrapers: fetch and extract data
  - RSS feeds: fetch and parse XML
  - Video streams: check if stream is accessible (HEAD request or probe)
  - For connectors that can't be verified (RTSP, MQTT), keep status based on user input or "unverified"
- Add a `lastChecked` timestamp per connector

### 6. Data Flow
```
User adds connector via Config page
  → stored in localStorage + Zustand store
  → appears on Map immediately (status: connecting/unverified)
  → refreshData() fires periodically
    → HTTP/HTTPS/RSS: fetch URL, get status code, measure latency, parse response
    → Video: check accessibility
    → MQTT/RTSP: show "unverified" (can't probe from browser)
  → Map nodes update color based on real status
  → Dashboard shows real metrics
  → Alerts fire on real failures (HTTP 4xx/5xx, timeouts, etc.)
```

### 7. Settings Page (Update views/Settings.tsx)
- Add map view mode toggle (2D / 3D / Split)
- Add data refresh interval
- Add "Reset to defaults" button (clears localStorage)
- Add "Export connectors" / "Import connectors" (JSON)

### 8. Polish
- All components properly typed
- Error boundaries on every view
- Responsive layout
- Keyboard shortcuts still work
- Clean build with zero type errors

## File Changes Summary
- **DELETE**: `views/Globe.tsx` (replaced by Map2D/Map3D/MapView)
- **NEW**: `views/Map2D.tsx`, `views/Map3D.tsx`, `views/MapView.tsx`, `views/ConnectorsConfig.tsx`
- **REWRITE**: `views/Video.tsx` (real players), `views/Dashboard.tsx` (real data), `views/Settings.tsx` (more options)
- **UPDATE**: `types.ts` (add connector config fields), `store.ts` (localStorage persistence, real refresh, map view mode), `data.ts` (mark as defaults), `App.tsx` (new nav items)
- **UPDATE**: `package.json` (add maplibre-gl, cesium, vidstack)

## Build Verification
Run `npm run build` after all changes. Must pass with zero errors.
