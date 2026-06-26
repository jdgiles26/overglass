import { memo } from 'react';
import { Sparkline } from './Sparkline';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  sparkline?: number[];
  sparkColor?: string;
}

export const MetricCard = memo(function MetricCard({ label, value, unit, sparkline, sparkColor }: MetricCardProps) {
  return (
    <div className="bg-surface-900/50 border border-surface-800 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-mono font-semibold text-gray-200">
        {value}{unit && <span className="text-xs text-gray-500 ml-1">{unit}</span>}
      </div>
      {sparkline && sparkline.length > 0 && (
        <div className="mt-1">
          <Sparkline data={sparkline} color={sparkColor} height={24} />
        </div>
      )}
    </div>
  );
});
