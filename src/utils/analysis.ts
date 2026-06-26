/* ─── Formatting & computation utilities ─── */
import type { IngestionPoint, VideoFeed } from '../types';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/* Compute aggregate stats from the store data */
export function computeAggregateStats(points: IngestionPoint[], feeds: VideoFeed[]) {
  const active = points.filter(p => p.status === 'active');
  const errors = points.filter(p => p.status === 'error');
  const connecting = points.filter(p => p.status === 'connecting');
  const totalBps = points.reduce((s, p) => s + p.dataRateBps, 0);
  const avgLatency = points.reduce((s, p) => s + p.metrics.latency, 0) / points.length;
  const totalMsgIn = points.reduce((s, p) => s + p.metrics.messagesIn, 0);
  const totalMsgOut = points.reduce((s, p) => s + p.metrics.messagesOut, 0);
  const totalBytesIn = points.reduce((s, p) => s + p.metrics.bytesIn, 0);
  const totalBytesOut = points.reduce((s, p) => s + p.metrics.bytesOut, 0);
  const totalErrors = points.reduce((s, p) => s + p.metrics.errorCount, 0);
  const avgErrorRate = points.reduce((s, p) => s + p.errorRate, 0) / points.length;
  const liveFeeds = feeds.filter(f => f.status === 'live');
  const totalCVObjects = feeds.reduce((s, f) => s + (f.cvAnalysis?.objectsDetected ?? 0), 0);
  const avgCVConf = feeds.length
    ? feeds.reduce((s, f) => s + (f.cvAnalysis?.confidence ?? 0), 0) / feeds.length
    : 0;
  const avgUptime = points.reduce((s, p) => s + parseFloat(p.uptime), 0) / points.length;

  // Per-region breakdown
  const regions = new Map<string, { count: number; bps: number; points: typeof points }>();
  points.forEach(p => {
    const r = regions.get(p.region) ?? { count: 0, bps: 0, points: [] };
    r.count++; r.bps += p.dataRateBps; r.points.push(p);
    regions.set(p.region, r);
  });

  // Per-type breakdown
  const types = new Map<string, number>();
  points.forEach(p => types.set(p.type, (types.get(p.type) ?? 0) + 1));

  return {
    activeCount: active.length,
    errorCount: errors.length,
    connectingCount: connecting.length,
    totalCount: points.length,
    totalBps,
    totalThroughputHuman: totalBps >= 1e9 ? `${(totalBps / 1e9).toFixed(1)} Gbps` : `${(totalBps / 1e6).toFixed(0)} Mbps`,
    avgLatency: Math.round(avgLatency),
    totalMsgIn,
    totalMsgOut,
    totalBytesIn,
    totalBytesOut,
    totalErrors,
    avgErrorRate: +avgErrorRate.toFixed(2),
    liveFeedCount: liveFeeds.length,
    totalFeedCount: feeds.length,
    totalCVObjects,
    avgCVConfidence: +(avgCVConf * 100).toFixed(1),
    avgUptime: +avgUptime.toFixed(2),
    regions: Array.from(regions.entries()).map(([name, r]) => ({
      name,
      count: r.count,
      bps: r.bps,
      throughput: r.bps >= 1e9 ? `${(r.bps / 1e9).toFixed(1)} Gbps` : `${(r.bps / 1e6).toFixed(0)} Mbps`,
      health: r.points.filter(p => p.status === 'active').length / r.count,
    })).sort((a, b) => b.bps - a.bps),
    types: Array.from(types.entries()).map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    errorPoints: errors,
    degradedPoints: [...errors, ...connecting],
  };
}

/* Generate a textual analysis from real data */
export function analyzeData(points: IngestionPoint[], feeds: VideoFeed[], query: string): string {
  const stats = computeAggregateStats(points, feeds);
  const lower = query.toLowerCase();

  if (lower.includes('status') || lower.includes('health') || lower.includes('overview')) {
    const lines = [
      `System Health Report — ${new Date().toLocaleString()}`,
      ``,
      `Connectors: ${stats.activeCount}/${stats.totalCount} active, ${stats.errorCount} errors, ${stats.connectingCount} connecting`,
      `Throughput: ${stats.totalThroughputHuman} aggregate`,
      `Avg Latency: ${stats.avgLatency}ms | Avg Error Rate: ${stats.avgErrorRate}%`,
      `Avg Uptime: ${stats.avgUptime}%`,
      `Video: ${stats.liveFeedCount}/${stats.totalFeedCount} live feeds, ${stats.totalCVObjects} total objects tracked`,
      ``,
    ];
    if (stats.errorPoints.length) {
      lines.push(`⚠ ERRORS:`);
      stats.errorPoints.forEach(p => {
        lines.push(`  • ${p.name}: ${p.errorRate}% error rate, ${p.metrics.errorCount} errors, ${p.metrics.reconnects} reconnects`);
      });
      lines.push('');
    }
    if (stats.connectingCount) {
      lines.push(`⏳ CONNECTING:`);
      points.filter(p => p.status === 'connecting').forEach(p => {
        lines.push(`  • ${p.name}: last seen ${p.lastSeen}, latency ${p.metrics.latency}ms`);
      });
      lines.push('');
    }
    lines.push(`Region breakdown:`);
    stats.regions.forEach(r => {
      lines.push(`  ${r.name}: ${r.count} connectors, ${r.throughput}, ${(r.health * 100).toFixed(0)}% healthy`);
    });
    return lines.join('\n');
  }

  if (lower.includes('video') || lower.includes('camera') || lower.includes('cv') || lower.includes('detect')) {
    const lines = [
      `Video Feed Analysis`,
      ``,
      `${stats.liveFeedCount} of ${stats.totalFeedCount} feeds live`,
      `Total objects detected: ${stats.totalCVObjects}`,
      `Average CV confidence: ${stats.avgCVConfidence}%`,
      ``,
    ];
    feeds.forEach(f => {
      const cv = f.cvAnalysis;
      lines.push(`${f.name} (${f.resolution} @ ${f.fps}fps, ${f.codec})`);
      if (cv) {
        lines.push(`  Objects: ${cv.objectsDetected} | Confidence: ${(cv.confidence * 100).toFixed(0)}% | CV FPS: ${cv.fps}`);
        const topClasses = Object.entries(cv.classes).sort((a, b) => b[1] - a[1]).slice(0, 3);
        lines.push(`  Top classes: ${topClasses.map(([c, n]) => `${c}: ${n}`).join(', ')}`);
      }
      lines.push('');
    });
    return lines.join('\n');
  }

  if (lower.includes('connector') || lower.includes('ingest') || lower.includes('protocol') || lower.includes('type')) {
    const lines = [
      `Connector Inventory`,
      ``,
      `Total: ${stats.totalCount} connectors across ${stats.regions.length} regions`,
      ``,
      `By type:`,
    ];
    stats.types.forEach(t => lines.push(`  ${t.type}: ${t.count}`));
    lines.push('');
    lines.push(`By region:`);
    stats.regions.forEach(r => lines.push(`  ${r.name}: ${r.count} connectors, ${r.throughput}`));
    return lines.join('\n');
  }

  if (lower.includes('throughput') || lower.includes('bandwidth') || lower.includes('rate') || lower.includes('traffic')) {
    const lines = [
      `Throughput Report`,
      ``,
      `Aggregate: ${stats.totalThroughputHuman}`,
      `Total bytes in: ${formatBytes(stats.totalBytesIn)}`,
      `Total bytes out: ${formatBytes(stats.totalBytesOut)}`,
      `Total messages in: ${formatNumber(stats.totalMsgIn)}`,
      `Total messages out: ${formatNumber(stats.totalMsgOut)}`,
      ``,
      `Top connectors by throughput:`,
    ];
    [...points].sort((a, b) => b.dataRateBps - a.dataRateBps).slice(0, 5).forEach(p => {
      lines.push(`  ${p.name}: ${p.dataRate} (${p.dataRateBps >= 1e9 ? (p.dataRateBps / 1e9).toFixed(1) : (p.dataRateBps / 1e6).toFixed(0)} ${p.dataRateBps >= 1e9 ? 'GB/s' : 'MB/s'})`);
    });
    return lines.join('\n');
  }

  if (lower.includes('latency') || lower.includes('slow') || lower.includes('performance') || lower.includes('perf')) {
    const lines = [
      `Latency Report`,
      ``,
      `Average: ${stats.avgLatency}ms`,
      ``,
      `By connector (sorted):`,
    ];
    [...points].sort((a, b) => b.metrics.latency - a.metrics.latency).forEach(p => {
      const bar = '█'.repeat(Math.max(1, Math.floor(p.metrics.latency / 10)));
      lines.push(`  ${p.name.padEnd(30)} ${String(p.metrics.latency).padStart(4)}ms ${bar}`);
    });
    return lines.join('\n');
  }

  if (lower.includes('error') || lower.includes('fail') || lower.includes('issue') || lower.includes('problem')) {
    const lines = [
      `Error Report`,
      ``,
      `Total errors across all connectors: ${formatNumber(stats.totalErrors)}`,
      `Average error rate: ${stats.avgErrorRate}%`,
      ``,
    ];
    const bad = [...points].sort((a, b) => b.errorRate - a.errorRate).filter(p => p.errorRate > 0.05);
    lines.push(`Connectors with elevated error rates:`);
    bad.forEach(p => {
      lines.push(`  ${p.name}: ${p.errorRate}% (${p.metrics.errorCount} errors, ${p.metrics.reconnects} reconnects) — ${p.status}`);
    });
    return lines.join('\n');
  }

  if (lower.includes('region') || lower.includes('geograph') || lower.includes('location')) {
    const lines = [`Regional Breakdown`, ``];
    stats.regions.forEach(r => {
      const rPoints = points.filter(p => p.region === r.name);
      lines.push(`${r.name} (${r.count} connectors, ${r.throughput}, ${(r.health * 100).toFixed(0)}% healthy)`);
      rPoints.forEach(p => {
        lines.push(`  ${p.name} — ${p.status} | ${p.dataRate} | ${p.metrics.latency}ms | ${p.errorRate}% errors`);
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  if (lower.includes('help') || lower.includes('command') || lower.includes('what can')) {
    return [
      `Available Analysis Queries:`,
      ``,
      `  "status" / "health" / "overview"  — Full system health report`,
      `  "video" / "camera" / "cv"         — Video feed & CV analysis`,
      `  "connector" / "ingest"            — Connector inventory by type`,
      `  "throughput" / "bandwidth"        — Throughput report with top talkers`,
      `  "latency" / "performance"         — Latency breakdown with visual bars`,
      `  "error" / "issue"                 — Error report & degraded connectors`,
      `  "region" / "geography"            — Regional breakdown`,
      ``,
      `Navigation commands: go to dashboard, globe, connectors, video, analyst, cv-agent, alerts, pipeline, terminal`,
    ].join('\n');
  }

  // Navigation commands
  if (lower.includes('dashboard')) return `__NAV:dashboard__Opening Dashboard.`;
  if (lower.includes('globe')) return `__NAV:globe__Opening 3D Globe view.`;
  if (lower.includes('connector')) return `__NAV:connectors__Opening Connectors view.`;
  if (lower.includes('video')) return `__NAV:video__Opening Video Feeds view.`;
  if (lower.includes('analyst')) return `__NAV:analyst__Opening AI Analyst view.`;
  if (lower.includes('cv') || lower.includes('agent')) return `__NAV:cv-agent__Opening CV Agent view.`;
  if (lower.includes('alert')) return `__NAV:alerts__Opening Alerts view.`;
  if (lower.includes('pipeline')) return `__NAV:pipeline__Opening Pipeline view.`;
  if (lower.includes('terminal')) return `__NAV:terminal__Opening Terminal view.`;

  // Generic — search through all data
  const q = query.toLowerCase();
  const matchingPoints = points.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.location.toLowerCase().includes(q) ||
    p.type.includes(q) ||
    p.protocol.toLowerCase().includes(q) ||
    p.region.toLowerCase().includes(q)
  );
  const matchingFeeds = feeds.filter(f =>
    f.name.toLowerCase().includes(q) ||
    f.location.toLowerCase().includes(q)
  );

  if (matchingPoints.length || matchingFeeds.length) {
    const lines = [`Results for "${query}"`, ``];
    matchingPoints.forEach(p => {
      lines.push(`Connector: ${p.name} (${p.type}) — ${p.status}`);
      lines.push(`  Location: ${p.location} | Protocol: ${p.protocol} | Rate: ${p.dataRate}`);
      lines.push(`  Latency: ${p.metrics.latency}ms | Errors: ${p.metrics.errorCount} | Uptime: ${p.uptime}`);
      lines.push('');
    });
    matchingFeeds.forEach(f => {
      lines.push(`Feed: ${f.name} — ${f.status}`);
      lines.push(`  Location: ${f.location} | ${f.resolution} @ ${f.fps}fps | ${f.codec}`);
      if (f.cvAnalysis) lines.push(`  CV: ${f.cvAnalysis.objectsDetected} objects, ${(f.cvAnalysis.confidence * 100).toFixed(0)}% confidence`);
      lines.push('');
    });
    return lines.join('\n');
  }

  return `Could not find data matching "${query}". Try: status, video, connectors, throughput, latency, errors, regions, or help.`;
}
