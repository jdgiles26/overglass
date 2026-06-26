/* ─── Core domain types ─── */

export type ConnectorType = 'connector' | 'api-key' | 'rtsp' | 'websocket' | 'mqtt' | 'kafka' | 'webhook' | 'ftp' | 'grpc' | 'amqp'
  | 'hls' | 'rest-api' | 'website' | 'rss';
export type ConnectorStatus = 'active' | 'inactive' | 'error' | 'connecting' | 'degraded' | 'unverified';
export type VideoStatus = 'live' | 'offline' | 'buffering' | 'error';
export type MapViewMode = '2d' | '3d' | 'split';
export type ViewId = 'dashboard' | 'globe' | 'connectors' | 'video' | 'analyst' | 'cv-agent' | 'alerts' | 'pipeline' | 'terminal' | 'settings'
  | 'connectors-config' | 'threat-intel' | 'screenshots' | 'rules' | 'timeline' | 'network';

export interface Metrics {
  messagesIn: number;
  messagesOut: number;
  bytesIn: number;
  bytesOut: number;
  latency: number;
  errorCount: number;
  reconnects: number;
}

export interface IngestionPoint {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  lat: number;
  lng: number;
  location: string;
  country: string;
  region: string;
  dataRate: string;
  dataRateBps: number;
  protocol: string;
  lastSeen: string;
  uptime: string;
  throughput: string;
  errorRate: number;
  tags: string[];
  config: Record<string, string>;
  metrics: Metrics;
  history?: Metrics[];
  lastChecked?: string;
  httpStatus?: number;
  responseTime?: number;
  url?: string;
}

export interface ConnectorFormData {
  name: string;
  type: ConnectorType;
  url: string;
  lat: number;
  lng: number;
  location: string;
  tags: string;
  username?: string;
  password?: string;
  port?: string;
  codec?: string;
  brokerUrl?: string;
  topic?: string;
  qos?: string;
  heartbeatInterval?: string;
  authMethod?: string;
  headers?: string;
  scrapeInterval?: string;
  cssSelectors?: string;
  pollInterval?: string;
}

export interface VideoFeed {
  id: string;
  name: string;
  url: string;
  type: 'rtsp' | 'http' | 'webrtc' | 'simulated' | 'hls';
  status: VideoStatus;
  lat: number;
  lng: number;
  location: string;
  fps: number;
  resolution: string;
  width: number;
  height: number;
  codec: string;
  bitrate: string;
  cvAnalysis?: {
    model: string;
    objectsDetected: number;
    classes: Record<string, number>;
    lastDetection: string;
    confidence: number;
    fps: number;
  };
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  metric?: {
    name: string;
    value: number;
    threshold: number;
  };
}

export interface PipelineNode {
  id: string;
  type: 'source' | 'transform' | 'sink' | 'buffer' | 'filter';
  label: string;
  status: 'running' | 'stopped' | 'error';
  throughput: number;
  connectedTo: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface CVTask {
  id: string;
  command: string;
  status: 'queued' | 'running' | 'done' | 'error';
  output: string;
  timestamp: string;
  duration: number;
}

/* ─── Phase 3 Types ─── */

export interface ThreatIndicator {
  id: string;
  type: 'malware' | 'phishing' | 'c2' | 'suspicious' | 'ransomware' | 'exploit' | 'botnet' | 'spam' | 'other';
  source: string;
  url: string;
  host: string;
  threat: string;
  date: string;
  description: string;
  tags: string[];
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  lat?: number;
  lng?: number;
}

export interface ScreenshotRecord {
  id: string;
  connectorId: string;
  connectorName: string;
  url: string;
  timestamp: string;
  thumbnail: string; // base64
  domHash: string;
  width: number;
  height: number;
  changed: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: AlertRuleCondition[];
  actions: AlertRuleAction[];
  cooldown: number; // seconds
  lastTriggered?: string;
  createdAt: string;
}

export interface AlertRuleCondition {
  field: 'connector.status' | 'connector.httpStatus' | 'connector.latency' | 'connector.errorRate' | 'threat.match' | 'screenshot.changed' | 'schedule';
  operator: 'equals' | 'not_equals' | 'gt' | 'lt' | 'contains' | 'changes' | 'cron';
  value: string | number;
}

export interface AlertRuleAction {
  type: 'browser_notification' | 'webhook' | 'log' | 'sound';
  config: Record<string, string>;
}

export interface TimelineEvent {
  id: string;
  type: 'connector.added' | 'connector.removed' | 'connector.status_change'
    | 'connector.fetch_success' | 'connector.fetch_failure'
    | 'threat.match' | 'threat.feed_updated'
    | 'screenshot.captured' | 'screenshot.change_detected'
    | 'rule.triggered' | 'rule.action_executed'
    | 'alert.acknowledged'
    | 'user.settings_changed'
    | 'device.discovered' | 'device.online' | 'device.offline';
  timestamp: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  connectorId?: string;
  connectorName?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface DiscoveredDevice {
  id: string;
  ip: string;
  hostname: string;
  lastSeen: string;
  openPorts: number[];
  deviceType: 'router' | 'camera' | 'server' | 'iot' | 'computer' | 'phone' | 'unknown';
  headers?: Record<string, string>;
  firstSeen: string;
  status: 'online' | 'offline';
  previousStatus?: 'online' | 'offline';
}

export interface AppSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  showVideoMarkers: boolean;
  theme: 'dark' | 'light';
  mapView: MapViewMode;
  networkSubnet: string;
  networkScanInterval: number;
  networkScanEnabled: boolean;
  screenshotServiceUrl: string;
}

export interface AppState {
  activeView: ViewId;
  ingestionPoints: IngestionPoint[];
  videoFeeds: VideoFeed[];
  alerts: Alert[];
  pipeline: PipelineNode[];
  chatMessages: ChatMessage[];
  cvTasks: CVTask[];
  showChat: boolean;
  showAlerts: boolean;
  globeMode: boolean;
  settings: AppSettings;

  /* Phase 3 state */
  threats: ThreatIndicator[];
  screenshots: ScreenshotRecord[];
  rules: AlertRule[];
  timeline: TimelineEvent[];
  devices: DiscoveredDevice[];

  /* Actions */
  setActiveView: (v: ViewId) => void;
  toggleChat: () => void;
  toggleAlerts: () => void;
  toggleGlobeMode: () => void;
  addChatMessage: (msg: ChatMessage) => void;
  addCVTask: (task: CVTask) => void;
  updateCVTask: (id: string, updates: Partial<CVTask>) => void;
  acknowledgeAlert: (id: string) => void;
  clearAcknowledged: () => void;
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  refreshData: () => void;
  addConnector: (connector: IngestionPoint) => void;
  removeConnector: (id: string) => void;
  updateConnector: (id: string, updates: Partial<IngestionPoint>) => void;
  resetToDefaults: () => void;

  /* Phase 3 actions */
  addThreats: (threats: ThreatIndicator[]) => void;
  clearThreats: () => void;
  addScreenshot: (screenshot: ScreenshotRecord) => void;
  removeScreenshotsForConnector: (connectorId: string) => void;
  addRule: (rule: AlertRule) => void;
  updateRule: (id: string, updates: Partial<AlertRule>) => void;
  removeRule: (id: string) => void;
  triggerRule: (ruleId: string, event: TimelineEvent) => void;
  addTimelineEvent: (event: TimelineEvent) => void;
  addDevice: (device: DiscoveredDevice) => void;
  updateDevice: (id: string, updates: Partial<DiscoveredDevice>) => void;
  removeDevice: (id: string) => void;
  exportTimeline: (format: 'json' | 'csv') => string;
}
