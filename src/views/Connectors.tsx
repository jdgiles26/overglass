import { useAppStore } from '../store';
import { StatusBadge } from '../components/StatusBadge';
import { MetricCard } from '../components/MetricCard';
import { Sparkline } from '../components/Sparkline';

export function ConnectorsView() {
  const points = useAppStore(s => s.ingestionPoints);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Connectors ({points.length})</h1>
      <div className="grid gap-3">
        {points.map(p => (
          <div key={p.id} className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-xs text-gray-500">{p.location} · {p.region}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <MetricCard label="Protocol" value={p.protocol} />
              <MetricCard label="Latency" value={p.metrics.latency} unit="ms" />
              <MetricCard label="Error Rate" value={p.errorRate.toFixed(2)} unit="%" />
              <MetricCard label="Uptime" value={p.uptime} />
            </div>
            {p.history && p.history.length > 1 && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">Latency Trend</div>
                <Sparkline data={p.history.map(h => h.latency)} color={p.status === 'error' ? '#ef4444' : '#6366f1'} height={28} />
              </div>
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              {p.tags.map(t => (
                <span key={t} className="px-2 py-0.5 text-xs bg-surface-800 rounded-full text-gray-400">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
