import { useAppStore } from '../store';
import { MetricCard } from '../components/MetricCard';

export function PipelineView() {
  const nodes = useAppStore(s => s.pipeline);

  const typeColors: Record<string, string> = {
    source: 'text-blue-400',
    transform: 'text-purple-400',
    sink: 'text-green-400',
    buffer: 'text-yellow-400',
    filter: 'text-orange-400',
  };

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Pipeline</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricCard label="Sources" value={nodes.filter(n => n.type === 'source').length} />
        <MetricCard label="Transforms" value={nodes.filter(n => n.type === 'transform').length} />
        <MetricCard label="Filters" value={nodes.filter(n => n.type === 'filter').length} />
        <MetricCard label="Sinks" value={nodes.filter(n => n.type === 'sink').length} />
      </div>
      <div className="flex flex-wrap gap-4">
        {nodes.map(n => (
          <div key={n.id} className="bg-surface-900/30 border border-surface-800 rounded-xl p-4 min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs uppercase tracking-wider ${typeColors[n.type] ?? 'text-gray-400'}`}>{n.type}</span>
              <span className={`w-2 h-2 rounded-full ${n.status === 'running' ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <h3 className="font-semibold">{n.label}</h3>
            <p className="text-sm text-gray-400 mt-1">{n.throughput.toLocaleString()} msgs/s</p>
            {n.connectedTo.length > 0 && (
              <p className="text-xs text-gray-600 mt-2">→ {n.connectedTo.join(', ')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
