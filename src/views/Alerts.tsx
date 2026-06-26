import { useAppStore } from '../store';

export function AlertsView() {
  const alerts = useAppStore(s => s.alerts);
  const acknowledgeAlert = useAppStore(s => s.acknowledgeAlert);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold">Alerts ({alerts.length})</h1>
      {alerts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">✅</div>
          <p>No active alerts</p>
        </div>
      )}
      <div className="space-y-2">
        {alerts.map(a => (
          <div
            key={a.id}
            className={`bg-surface-900/30 border rounded-xl p-4 ${
              a.acknowledged ? 'border-surface-800 opacity-60' :
              a.severity === 'critical' ? 'border-red-500/30' :
              a.severity === 'warning' ? 'border-yellow-500/30' :
              'border-blue-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">
                  {a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '🔵'}
                </span>
                <div>
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="text-sm text-gray-400">{a.source}</p>
                </div>
              </div>
              {!a.acknowledged && (
                <button
                  onClick={() => acknowledgeAlert(a.id)}
                  className="px-3 py-1 text-xs bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
                >
                  Acknowledge
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">{a.message}</p>
            <p className="text-xs text-gray-600 mt-1">{new Date(a.timestamp).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
