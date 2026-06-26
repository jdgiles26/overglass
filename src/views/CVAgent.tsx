import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { useAppStore } from '../store';
import { MetricCard } from '../components/MetricCard';

const COLORS = ['#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6'];

export function CVAgentView() {
  const feeds = useAppStore(s => s.videoFeeds);
  const [selectedFeed, setSelectedFeed] = useState(feeds[0]?.id ?? '');

  const active = feeds.find(f => f.id === selectedFeed) ?? feeds[0];

  const aggregateClasses = useMemo(() => {
    const map = new Map<string, number>();
    feeds.forEach(f => {
      if (!f.cvAnalysis) return;
      Object.entries(f.cvAnalysis.classes).forEach(([cls, count]) => {
        map.set(cls, (map.get(cls) ?? 0) + count);
      });
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [feeds]);

  const confidenceData = useMemo(
    () => feeds
      .filter(f => f.cvAnalysis)
      .map(f => ({
        name: f.name.split(' ').slice(0, 3).join(' '),
        confidence: +(f.cvAnalysis!.confidence * 100).toFixed(1),
        objects: f.cvAnalysis!.objectsDetected,
      })),
    [feeds]
  );

  const feedClasses = useMemo(() => {
    if (!active?.cvAnalysis) return [];
    return Object.entries(active.cvAnalysis.classes)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [active]);

  const avgConf = feeds.reduce((s, f) => s + (f.cvAnalysis?.confidence ?? 0), 0) / feeds.length;
  const totalObjects = feeds.reduce((s, f) => s + (f.cvAnalysis?.objectsDetected ?? 0), 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">CV Agent</h1>
        <select
          value={selectedFeed}
          onChange={(e) => setSelectedFeed(e.target.value)}
          className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm"
        >
          {feeds.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Live Feeds" value={feeds.filter(f => f.status === 'live').length} />
        <MetricCard label="Total Objects" value={totalObjects} />
        <MetricCard label="Avg Confidence" value={(avgConf * 100).toFixed(1)} unit="%" />
        <MetricCard label="Models" value={new Set(feeds.filter(f => f.cvAnalysis).map(f => f.cvAnalysis!.model)).size} />
      </div>

      {/* Selected feed detail */}
      {active?.cvAnalysis && (
        <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">{active.name}</h2>
              <p className="text-sm text-gray-500">{active.location} · {active.resolution} @ {active.fps}fps · {active.codec}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-green-400">{(active.cvAnalysis.confidence * 100).toFixed(0)}%</div>
              <div className="text-xs text-gray-500">confidence</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <MetricCard label="Objects Detected" value={active.cvAnalysis.objectsDetected} />
            <MetricCard label="CV FPS" value={active.cvAnalysis.fps} />
            <MetricCard label="Model" value={active.cvAnalysis.model} />
          </div>

          {/* Feed-specific class breakdown */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={feedClasses} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {feedClasses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* All feeds confidence + object count */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <h2 className="font-semibold mb-4">Confidence by Feed</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} stroke="#374151" angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="confidence" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <h2 className="font-semibold mb-4">Objects by Feed</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={confidenceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} stroke="#374151" angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="objects" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Aggregate class distribution */}
      <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
        <h2 className="font-semibold mb-4">Global Object Distribution (All Feeds)</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {aggregateClasses.map((cls, i) => (
            <div key={cls.name} className="bg-surface-800/50 rounded-lg p-3 text-center">
              <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <div className="text-lg font-mono font-semibold">{cls.value}</div>
              <div className="text-xs text-gray-500">{cls.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
