/* ─── Demo default seed data ─── */
/* These are example connectors shown when no user data exists.
   They use fictional hostnames that will fail verification (status: "unverified"). */
import type { IngestionPoint, VideoFeed, Alert, PipelineNode, ConnectorType } from './types';

/* Seeded RNG for consistent data across refreshes */
function mulberry32(a: number) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

/* Helper to create a demo default ingestion point */
function makeDefaultPoint(opts: {
  id: string; name: string; type: ConnectorType; status: IngestionPoint['status'];
  lat: number; lng: number; location: string; country: string; region: string;
  dataRate: string; dataRateBps: number; protocol: string;
  tags: string[]; config: Record<string, string>; url: string;
}): IngestionPoint {
  return {
    ...opts,
    lastSeen: 'never', uptime: '0.00%', throughput: opts.dataRate.replace('Gbps', ' GB/s').replace('Mbps', ' MB/s'),
    errorRate: 0, lastChecked: undefined, httpStatus: undefined, responseTime: undefined,
    metrics: { messagesIn: 0, messagesOut: 0, bytesIn: 0, bytesOut: 0, latency: 0, errorCount: 0, reconnects: 0 },
    history: [],
  };
}

export const defaultIngestionPoints: IngestionPoint[] = [
  makeDefaultPoint({
    id: 'la-gw', name: 'Los Angeles Gateway', type: 'connector', status: 'unverified',
    lat: 34.0522, lng: -118.2437, location: 'Los Angeles, CA', country: 'US', region: 'us-west-2',
    dataRate: '2.4 Gbps', dataRateBps: 300_000_000, protocol: 'TCP/HTTPS',
    tags: ['production', 'edge', 'video'],
    config: { endpoint: 'https://la-gw.overglass.io', tls: '1.3' }, url: 'https://la-gw.overglass.io',
  }),
  makeDefaultPoint({
    id: 'nyc-fin', name: 'NYC Financial Feed', type: 'rest-api', status: 'unverified',
    lat: 40.7128, lng: -74.006, location: 'New York, NY', country: 'US', region: 'us-east-1',
    dataRate: '1.8 Gbps', dataRateBps: 225_000_000, protocol: 'REST/GraphQL',
    tags: ['production', 'financial', 'api'],
    config: { endpoint: 'https://nyc-api.overglass.io', authMethod: 'bearer' }, url: 'https://nyc-api.overglass.io',
  }),
  makeDefaultPoint({
    id: 'chi-iot', name: 'Chicago IoT Hub', type: 'mqtt', status: 'unverified',
    lat: 41.8781, lng: -87.6298, location: 'Chicago, IL', country: 'US', region: 'us-central-1',
    dataRate: '500 Mbps', dataRateBps: 62_500_000, protocol: 'MQTT v5',
    tags: ['production', 'iot', 'sensors'],
    config: { broker: 'mqtt://chicago.overglass.io:8883', topic: 'iot/+/telemetry' }, url: 'mqtt://chicago.overglass.io:8883',
  }),
  makeDefaultPoint({
    id: 'dal-vid', name: 'Dallas Video RTSP', type: 'rtsp', status: 'unverified',
    lat: 32.7767, lng: -96.797, location: 'Dallas, TX', country: 'US', region: 'us-south-1',
    dataRate: '800 Mbps', dataRateBps: 100_000_000, protocol: 'RTSP/RTP',
    tags: ['production', 'video', 'rtsp'],
    config: { stream: 'rtsp://dallas-cam.overglass.io:554/live', codec: 'H.265' }, url: 'rtsp://dallas-cam.overglass.io:554/live',
  }),
  makeDefaultPoint({
    id: 'sea-kfk', name: 'Seattle Kafka Stream', type: 'kafka', status: 'unverified',
    lat: 47.6062, lng: -122.3321, location: 'Seattle, WA', country: 'US', region: 'us-west-1',
    dataRate: '3.2 Gbps', dataRateBps: 400_000_000, protocol: 'Kafka v3.6',
    tags: ['production', 'streaming', 'ml-pipeline'],
    config: { brokers: 'kafka-sea-1:9092,kafka-sea-2:9092', topics: 'ingestion,analytics' }, url: 'kafka-sea-1:9092',
  }),
  makeDefaultPoint({
    id: 'lon-hub', name: 'London Data Hub', type: 'connector', status: 'unverified',
    lat: 51.5074, lng: -0.1278, location: 'London', country: 'GB', region: 'eu-west-2',
    dataRate: '1.5 Gbps', dataRateBps: 187_500_000, protocol: 'gRPC/HTTP2',
    tags: ['production', 'eu', 'edge'],
    config: { endpoint: 'https://london-gw.overglass.io', tls: '1.3' }, url: 'https://london-gw.overglass.io',
  }),
  makeDefaultPoint({
    id: 'fra-api', name: 'Frankfurt API Gateway', type: 'rest-api', status: 'unverified',
    lat: 50.1109, lng: 8.6821, location: 'Frankfurt', country: 'DE', region: 'eu-central-1',
    dataRate: '2.1 Gbps', dataRateBps: 262_500_000, protocol: 'REST/OpenAPI',
    tags: ['production', 'eu', 'api'],
    config: { endpoint: 'https://fra-api.overglass.io', authMethod: 'apikey' }, url: 'https://fra-api.overglass.io',
  }),
  makeDefaultPoint({
    id: 'par-mqt', name: 'Paris MQTT Broker', type: 'mqtt', status: 'unverified',
    lat: 48.8566, lng: 2.3522, location: 'Paris', country: 'FR', region: 'eu-west-1',
    dataRate: '350 Mbps', dataRateBps: 43_750_000, protocol: 'MQTT v5',
    tags: ['production', 'eu', 'iot'],
    config: { broker: 'mqtt://paris.overglass.io:8883', topic: 'sensors/+/data' }, url: 'mqtt://paris.overglass.io:8883',
  }),
  makeDefaultPoint({
    id: 'ams-ws', name: 'Amsterdam WebSocket', type: 'websocket', status: 'unverified',
    lat: 52.3676, lng: 4.9041, location: 'Amsterdam', country: 'NL', region: 'eu-west-3',
    dataRate: '600 Mbps', dataRateBps: 75_000_000, protocol: 'WebSocket/JSON',
    tags: ['staging', 'eu', 'websocket'],
    config: { url: 'wss://ams.overglass.io/stream', heartbeat: '30s' }, url: 'wss://ams.overglass.io/stream',
  }),
  makeDefaultPoint({
    id: 'tok-vid', name: 'Tokyo RTSP Cluster', type: 'rtsp', status: 'unverified',
    lat: 35.6762, lng: 139.6503, location: 'Tokyo', country: 'JP', region: 'ap-northeast-1',
    dataRate: '1.2 Gbps', dataRateBps: 150_000_000, protocol: 'RTSP/H.265',
    tags: ['production', 'apac', 'video'],
    config: { stream: 'rtsp://tokyo-cam.overglass.io:554/live', codec: 'H.265' }, url: 'rtsp://tokyo-cam.overglass.io:554/live',
  }),
  makeDefaultPoint({
    id: 'sgp-kfk', name: 'Singapore Kafka', type: 'kafka', status: 'unverified',
    lat: 1.3521, lng: 103.8198, location: 'Singapore', country: 'SG', region: 'ap-southeast-1',
    dataRate: '2.8 Gbps', dataRateBps: 350_000_000, protocol: 'Kafka v3.6',
    tags: ['production', 'apac', 'streaming'],
    config: { brokers: 'kafka-sg-1:9092', topics: 'events,logs' }, url: 'kafka-sg-1:9092',
  }),
  makeDefaultPoint({
    id: 'syd-wh', name: 'Sydney Webhook', type: 'webhook', status: 'unverified',
    lat: -33.8688, lng: 151.2093, location: 'Sydney', country: 'AU', region: 'ap-southeast-2',
    dataRate: '400 Mbps', dataRateBps: 50_000_000, protocol: 'HTTP/JSON',
    tags: ['production', 'apac', 'webhook'],
    config: { url: 'https://sydney.overglass.io/webhook' }, url: 'https://sydney.overglass.io/webhook',
  }),
  makeDefaultPoint({
    id: 'sel-api', name: 'Seoul API Connector', type: 'rest-api', status: 'unverified',
    lat: 37.5665, lng: 126.978, location: 'Seoul', country: 'KR', region: 'ap-northeast-2',
    dataRate: '0 Mbps', dataRateBps: 0, protocol: 'REST',
    tags: ['production', 'apac', 'api'],
    config: { endpoint: 'https://seoul-api.overglass.io' }, url: 'https://seoul-api.overglass.io',
  }),
  makeDefaultPoint({
    id: 'sao-ftp', name: 'São Paulo FTP Sink', type: 'ftp', status: 'unverified',
    lat: -23.5505, lng: -46.6333, location: 'São Paulo', country: 'BR', region: 'sa-east-1',
    dataRate: '200 Mbps', dataRateBps: 25_000_000, protocol: 'SFTP',
    tags: ['production', 'latam', 'batch'],
    config: { host: 'sftp-sp.overglass.io', port: '22' }, url: 'sftp://sp.overglass.io/data',
  }),
  makeDefaultPoint({
    id: 'los-iot', name: 'Lagos IoT Gateway', type: 'connector', status: 'unverified',
    lat: 6.5244, lng: 3.3792, location: 'Lagos', country: 'NG', region: 'af-west-1',
    dataRate: '150 Mbps', dataRateBps: 18_750_000, protocol: 'CoAP/UDP',
    tags: ['production', 'africa', 'iot'],
    config: { endpoint: 'https://lagos-gw.overglass.io' }, url: 'https://lagos-gw.overglass.io',
  }),
  makeDefaultPoint({
    id: 'dub-ws', name: 'Dubai Real-time Stream', type: 'websocket', status: 'unverified',
    lat: 25.2048, lng: 55.2708, location: 'Dubai', country: 'AE', region: 'me-central-1',
    dataRate: '900 Mbps', dataRateBps: 112_500_000, protocol: 'WebSocket/Binary',
    tags: ['production', 'middle-east', 'realtime'],
    config: { url: 'wss://dubai.overglass.io/stream', heartbeat: '15s' }, url: 'wss://dubai.overglass.io/stream',
  }),
];

/* ─── Video Feeds (demo defaults) ─── */
export const defaultVideoFeeds: VideoFeed[] = [
  {
    id: 'vf-la', name: 'LA Traffic Cam — I-405', type: 'rtsp', status: 'offline',
    lat: 34.0522, lng: -118.2437, location: 'Los Angeles, CA',
    fps: 30, resolution: '1920x1080', width: 1920, height: 1080, codec: 'H.265', bitrate: '8 Mbps',
    url: 'rtsp://demo:demo@192.168.1.100:554/stream1',
  },
  {
    id: 'vf-nyc', name: 'NYC Times Square', type: 'rtsp', status: 'offline',
    lat: 40.758, lng: -73.9855, location: 'New York, NY',
    fps: 30, resolution: '3840x2160', width: 3840, height: 2160, codec: 'H.265', bitrate: '20 Mbps',
    url: 'rtsp://demo:demo@192.168.1.101:554/stream1',
  },
  {
    id: 'vf-lon', name: 'London Bridge Cam', type: 'rtsp', status: 'offline',
    lat: 51.5074, lng: -0.1278, location: 'London, UK',
    fps: 25, resolution: '1920x1080', width: 1920, height: 1080, codec: 'H.264', bitrate: '6 Mbps',
    url: 'rtsp://demo:demo@192.168.1.102:554/stream1',
  },
  {
    id: 'vf-tok', name: 'Tokyo Shibuya Crossing', type: 'rtsp', status: 'offline',
    lat: 35.6595, lng: 139.7004, location: 'Tokyo, Japan',
    fps: 60, resolution: '3840x2160', width: 3840, height: 2160, codec: 'H.265', bitrate: '24 Mbps',
    url: 'rtsp://demo:demo@192.168.1.103:554/stream1',
  },
  {
    id: 'vf-sgp', name: 'Singapore Port', type: 'rtsp', status: 'offline',
    lat: 1.3521, lng: 103.8198, location: 'Singapore',
    fps: 30, resolution: '1920x1080', width: 1920, height: 1080, codec: 'H.265', bitrate: '10 Mbps',
    url: 'rtsp://demo:demo@192.168.1.104:554/stream1',
  },
  {
    id: 'vf-fra', name: 'Frankfurt Airport T1', type: 'rtsp', status: 'offline',
    lat: 50.0379, lng: 8.5622, location: 'Frankfurt, Germany',
    fps: 30, resolution: '2560x1440', width: 2560, height: 1440, codec: 'H.265', bitrate: '14 Mbps',
    url: 'rtsp://demo:demo@192.168.1.105:554/stream1',
  },
  {
    id: 'vf-syd', name: 'Sydney Harbour Bridge', type: 'rtsp', status: 'offline',
    lat: -33.8568, lng: 151.2153, location: 'Sydney, Australia',
    fps: 30, resolution: '1920x1080', width: 1920, height: 1080, codec: 'H.264', bitrate: '6 Mbps',
    url: 'rtsp://demo:demo@192.168.1.106:554/stream1',
  },
  {
    id: 'vf-dub', name: 'Dubai Marina', type: 'rtsp', status: 'offline',
    lat: 25.0804, lng: 55.1403, location: 'Dubai, UAE',
    fps: 30, resolution: '1920x1080', width: 1920, height: 1080, codec: 'H.265', bitrate: '10 Mbps',
    url: 'rtsp://demo:demo@192.168.1.107:554/stream1',
  },
];

/* ─── Pipeline DAG ─── */
export const pipeline: PipelineNode[] = [
  { id: 'p-src-1', type: 'source', label: 'RTSP Ingest', status: 'running', throughput: 2400, connectedTo: ['p-xf-1'] },
  { id: 'p-src-2', type: 'source', label: 'Kafka Source', status: 'running', throughput: 48000, connectedTo: ['p-xf-1', 'p-xf-2'] },
  { id: 'p-src-3', type: 'source', label: 'MQTT Broker', status: 'running', throughput: 16500, connectedTo: ['p-buf-1'] },
  { id: 'p-buf-1', type: 'buffer', label: 'Redis Buffer', status: 'running', throughput: 16500, connectedTo: ['p-xf-1'] },
  { id: 'p-xf-1', type: 'transform', label: 'Schema Norm.', status: 'running', throughput: 64900, connectedTo: ['p-flt-1', 'p-flt-2'] },
  { id: 'p-xf-2', type: 'transform', label: 'ML Feature Ext.', status: 'running', throughput: 48000, connectedTo: ['p-snk-2'] },
  { id: 'p-flt-1', type: 'filter', label: 'Dedup / Rate', status: 'running', throughput: 62000, connectedTo: ['p-snk-1'] },
  { id: 'p-flt-2', type: 'filter', label: 'CV Filter', status: 'running', throughput: 2900, connectedTo: ['p-snk-3'] },
  { id: 'p-snk-1', type: 'sink', label: 'Elasticsearch', status: 'running', throughput: 62000, connectedTo: [] },
  { id: 'p-snk-2', type: 'sink', label: 'ML Pipeline', status: 'running', throughput: 48000, connectedTo: [] },
  { id: 'p-snk-3', type: 'sink', label: 'S3 Archive', status: 'running', throughput: 2900, connectedTo: [] },
];

/* ─── Compute alerts from connector states ─── */
export function computeAlerts(points: IngestionPoint[], feeds: VideoFeed[]): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();

  for (const p of points) {
    if (p.status === 'error') {
      alerts.push({
        id: `a-${p.id}`, severity: 'critical', source: p.name,
        title: 'Connector Error',
        message: `${p.name} returned HTTP ${p.httpStatus ?? 'unknown'}. Response time: ${p.responseTime ?? '?'}ms.`,
        timestamp: new Date(now.getTime() - 120000).toISOString(),
        acknowledged: false,
        metric: { name: 'httpStatus', value: p.httpStatus ?? 0, threshold: 400 },
      });
    }
    if (p.lastChecked && p.status === 'unverified' && !p.httpStatus) {
      alerts.push({
        id: `a-${p.id}-unverified`, severity: 'info', source: p.name,
        title: 'Connector Unverified',
        message: `${p.name} has not been verified yet. Type: ${p.type}.`,
        timestamp: new Date(now.getTime() - 5000).toISOString(),
        acknowledged: false,
      });
    }
    if (p.responseTime && p.responseTime > 2000) {
      alerts.push({
        id: `a-${p.id}-slow`, severity: 'warning', source: p.name,
        title: 'High Latency',
        message: `${p.name} response time is ${p.responseTime}ms (threshold: 2000ms).`,
        timestamp: new Date(now.getTime() - 5000).toISOString(),
        acknowledged: false,
        metric: { name: 'responseTime', value: p.responseTime, threshold: 2000 },
      });
    }
  }

  for (const f of feeds) {
    if (f.status === 'error') {
      alerts.push({
        id: `a-${f.id}`, severity: 'warning', source: f.name,
        title: 'Feed Error',
        message: `${f.name} (${f.type}) — feed encountered an error.`,
        timestamp: new Date(now.getTime() - 10000).toISOString(),
        acknowledged: false,
      });
    }
  }

  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/* Backwards compat aliases */
export const ingestionPoints = defaultIngestionPoints;
export const videoFeeds = defaultVideoFeeds;

/* ─── Open-source connector catalog ─── */
export const openSourceConnectors = [
  { name: 'Prometheus', type: 'api-key' as const, protocol: 'HTTP/PromQL', desc: 'Scrape metrics from Prometheus instances', icon: '📊', docs: 'https://prometheus.io' },
  { name: 'Elasticsearch', type: 'connector' as const, protocol: 'REST', desc: 'Ingest log data from ES clusters', icon: '📋', docs: 'https://elastic.co' },
  { name: 'Grafana Loki', type: 'connector' as const, protocol: 'LogQL', desc: 'Stream log aggregation', icon: '🔍', docs: 'https://grafana.com/oss/loki' },
  { name: 'Apache NiFi', type: 'connector' as const, protocol: 'NiFi API', desc: 'Data flow orchestration', icon: '🔄', docs: 'https://nifi.apache.org' },
  { name: 'Telegraf', type: 'mqtt' as const, protocol: 'MQTT/StatsD', desc: 'System & app metrics collection', icon: '📡', docs: 'https://telegraf.influxdata.com' },
  { name: 'Fluentd', type: 'websocket' as const, protocol: 'Forward', desc: 'Unified logging layer', icon: '📝', docs: 'https://fluentd.org' },
  { name: 'Apache Flink', type: 'kafka' as const, protocol: 'Flink SQL', desc: 'Stream processing pipeline', icon: '⚡', docs: 'https://flink.apache.org' },
  { name: 'OpenTelemetry', type: 'connector' as const, protocol: 'OTLP/gRPC', desc: 'Distributed tracing & metrics', icon: '🔗', docs: 'https://opentelemetry.io' },
  { name: 'InfluxDB', type: 'api-key' as const, protocol: 'Flux/HTTP', desc: 'Time-series data ingestion', icon: '📈', docs: 'https://influxdata.com' },
  { name: 'PostgreSQL CDC', type: 'connector' as const, protocol: 'Logical Decoding', desc: 'Change Data Capture from PG', icon: '🗃️', docs: 'https://postgresql.org' },
  { name: 'Redis Streams', type: 'connector' as const, protocol: 'RESP3', desc: 'Real-time event streaming', icon: '⚡', docs: 'https://redis.io' },
  { name: 'NATS JetStream', type: 'websocket' as const, protocol: 'NATS', desc: 'Cloud-native messaging', icon: '💬', docs: 'https://nats.io' },
  { name: 'Apache Pulsar', type: 'kafka' as const, protocol: 'Pulsar Protocol', desc: 'Next-gen distributed pub-sub', icon: '🔥', docs: 'https://pulsar.apache.org' },
  { name: 'Vector.dev', type: 'connector' as const, protocol: 'VRL', desc: 'High-performance observability pipeline', icon: '🚀', docs: 'https://vector.dev' },
  { name: 'Kafka Connect', type: 'kafka' as const, protocol: 'Connect API', desc: 'Source/sink connectors ecosystem', icon: '🔌', docs: 'https://kafka.apache.org' },
  { name: 'Envoy Proxy', type: 'grpc' as const, protocol: 'xDS/HTTP', desc: 'Service mesh data plane', icon: '🌐', docs: 'https://envoyproxy.io' },
];
