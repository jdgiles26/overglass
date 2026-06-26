import { useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = '#6366f1', height = 32 }: SparklineProps) {
  const chartData = useMemo(
    () => data.map((v, i) => ({ i, v })),
    [data]
  );

  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
