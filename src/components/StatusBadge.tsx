interface StatusBadgeProps {
  status: string;
}

const colorMap: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  connecting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  degraded: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  live: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  running: 'bg-green-500/20 text-green-400 border-green-500/30',
  stopped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${colorMap[status] ?? colorMap.inactive}`}>
      {status}
    </span>
  );
}
