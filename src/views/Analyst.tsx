import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import { useAppStore } from '../store';
import { MetricCard } from '../components/MetricCard';
import { computeAggregateStats } from '../utils/analysis';
import type { IngestionPoint } from '../types';

type MetricFilter = 'latency' | 'throughput' | 'errorRate' | 'messages';

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export function AnalystView() {
  const points = useAppStore(s => s.ingestionPoints);
  const feeds = useAppStore(s => s.videoFeeds);
  const [metric, setMetric] = useState<MetricFilter>('throughput');

  const stats = useMemo(() => computeAggregateStats(points, feeds), [points, feeds]);

  const barData = useMemo(() => {
    return [...points]
      .sort((a, b) => {
        switch (metric) {
          case 'latency': return b.metrics.latency - a.metrics.latency;
          case 'throughput': return b.dataRateBps - a.dataRateBps;
          case 'errorRate': return b.errorRate - a.errorRate;
          case 'messages': return b.metrics.messagesIn - a.metrics.messagesIn;
        }
      })
      .slice(0, 10)
      .map(p => ({
        name: p.name.split(' ').slice(0, 2).join(' '),
        value: (() => {
          switch (metric) {
            case 'latency': return p.metrics.latency;
            case 'throughput': return +(p.dataRateBps / 1e6).toFixed(0);
            case 'errorRate': return +p.errorRate.toFixed(2);
            case 'messages': return +(p.metrics.messagesIn / 1000).toFixed(0);
          }
        })(),
        status: p.status,
      }));
  }, [points, metric]);

  const typeData = useMemo(
    () => stats.types.map(t => ({ name: t.type, value: t.count })),
    [stats]
  );

  const regionData = useMemo(
    () => stats.regions.map(r => ({ name: r.name, value: r.count, fill: COLORS[r.name.length % COLORS.length] })),
    [stats]
  );

  const metricLabel: Record<MetricFilter, string> = {
    latency: 'Latency (ms)',
    throughput: 'Throughput (MB/s)',
    errorRate: 'Error Rate (%)',
    messages: 'Messages (K)',
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analyst</h1>
        <div className="flex gap-1">
          {(['throughput', 'latency', 'errorRate', 'messages'] as MetricFilter[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                metric === m
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'bg-surface-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Active" value={stats.activeCount} />
        <MetricCard label="Avg Latency" value={stats.avgLatency} unit="ms" />
        <MetricCard label="Total Errors" value={stats.totalErrors} />
        <MetricCard label="Avg Uptime" value={stats.avgUptime} unit="%" />
      </div>

      {/* Bar chart */}
      <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
        <h2 className="font-semibold mb-4">Top Connectors — {metricLabel[metric]}</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#9ca3af', fontSize: 11 }} stroke="#374151" />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.status === 'error' ? '#ef4444' : entry.status === 'connecting' ? '#f59e0b' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <h2 className="font-semibold mb-4">By Type</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
          <h2 className="font-semibold mb-4">By Region</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={regionData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {regionData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Region health table */}
      <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-4">
        <h2 className="font-semibold mb-4">Regional Health</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-surface-800/50">
                <th className="text-left px-4 py-2 font-medium">Region</th>
                <th className="text-right px-4 py-2 font-medium">Connectors</th>
                <th className="text-right px-4 py-2 font-medium">Throughput</th>
                <th className="text-right px-4 py-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {stats.regions.map(r => (
                <tr key={r.name} className="border-b border-surface-800/30">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-right">{r.count}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-400">{r.throughput}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={r.health >= 0.9 ? 'text-green-400' : r.health >= 0.7 ? 'text-yellow-400' : 'text-red-400'}>
                      {(r.health * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
