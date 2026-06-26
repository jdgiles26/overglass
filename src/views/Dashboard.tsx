/* ─── Dashboard: Real data from connector verification ─── */
import { useAppStore } from '../store';
import { StatusBadge } from '../components/StatusBadge';
import { MetricCard } from '../components/MetricCard';
import { Sparkline } from '../components/Sparkline';

export function DashboardView() {
  const points = useAppStore(s => s.ingestionPoints);
  const alerts = useAppStore(s => s.alerts);
  const feeds = useAppStore(s => s.videoFeeds);
  const setActiveView = useAppStore(s => s.setActiveView);

  const activeCount = points.filter(p => p.status === 'active').length;
  const errorCount = points.filter(p => p.status === 'error').length;
  const unverifiedCount = points.filter(p => p.status === 'unverified').length;
  const verifiedCount = points.filter(p => p.lastChecked).length;
  const totalThroughput = points.reduce((sum, p) => sum + p.dataRateBps, 0);
  const avgLatency = points.length
    ? Math.round(points.reduce((sum, p) => sum + (p.responseTime ?? p.metrics.latency), 0) / points.length)
    : 0;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-sm text-gray-500">{new Date().toLocaleString()}</span>
      </div>

      {/* Key metrics — all real */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Total Connectors" value={points.length} />
        <MetricCard label="Active" value={activeCount} />
        <MetricCard label="Errors" value={errorCount} />
        <MetricCard label="Unverified" value={unverifiedCount} />
        <MetricCard label="Avg Response Time" value={avgLatency} unit="ms" />
      </div>

      {/* Verification status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Verified" value={verifiedCount} unit={`/ ${points.length}`} />
        <MetricCard label="Video Feeds" value={feeds.length} />
        <MetricCard label="Alerts" value={alerts.filter(a => !a.acknowledged).length} />
        <MetricCard label="Known Throughput" value={(totalThroughput / 1e9).toFixed(1)} unit="GB/s" />
      </div>

      {/* Connector table with real data */}
      <div className="bg-surface-900/30 border border-surface-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
          <h2 className="font-semibold">Ingestion Points</h2>
          <button
            onClick={() => setActiveView('connectors')}
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            View all →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-surface-800/50">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Resp Time</th>
                <th className="text-right px-4 py-2 font-medium">HTTP</th>
                <th className="text-left px-4 py-2 font-medium">Last Checked</th>
                <th className="text-left px-4 py-2 font-medium w-24">History</th>
              </tr>
            </thead>
            <tbody>
              {points.map(p => (
                <tr key={p.id} className="border-b border-surface-800/30 hover:bg-surface-800/20 transition-colors">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-gray-400">{p.type}</td>
                  <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2 text-right font-mono">
                    {p.responseTime != null ? `${p.responseTime}ms` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {p.httpStatus ? (
                      <span className={p.httpStatus >= 400 ? 'text-red-400' : 'text-green-400'}>
                        {p.httpStatus}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {p.lastChecked ? new Date(p.lastChecked).toLocaleTimeString() : 'Never'}
                  </td>
                  <td className="px-4 py-2">
                    <Sparkline
                      data={p.history?.map(h => h.latency) ?? []}
                      height={20}
                      color={p.status === 'error' ? '#ef4444' : p.status === 'active' ? '#22c55e' : '#6b7280'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-red-400">⚠ Active Alerts ({alerts.length})</h2>
            <button
              onClick={() => setActiveView('alerts')}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              View all →
            </button>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <span className={a.severity === 'critical' ? 'text-red-400' : a.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'}>
                  {a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '🔵'}
                </span>
                <div>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-gray-500 text-xs">{a.source} — {a.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
