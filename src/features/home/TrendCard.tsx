import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../../ui/primitives/Card';

export interface TrendPoint {
  label: string;
  weight: number;
  fat?: number;
  muscle?: number;
}

type MetricKey = 'weight' | 'fat' | 'muscle';

const METRICS: { key: MetricKey; label: string; unit: string; color: string }[] = [
  { key: 'weight', label: 'Weight', unit: 'kg', color: 'var(--ui-primary)' },
  { key: 'fat', label: 'Body Fat', unit: '%', color: '#7C4DFF' },
  { key: 'muscle', label: 'Muscle', unit: 'kg', color: '#1A7F4B' },
];

export const TrendCard: React.FC<{ points: TrendPoint[] }> = ({ points }) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('weight');
  const metric = METRICS.find(m => m.key === selectedMetric) || METRICS[0];

  const hasData = points.length >= 2;
  const values = points.map(p => p[selectedMetric]).filter((v): v is number => v !== undefined && v > 0);
  const showChart = hasData && values.length >= 2;

  const minVal = values.length > 0 ? Math.floor(Math.min(...values) - 1) : 0;
  const maxVal = values.length > 0 ? Math.ceil(Math.max(...values) + 1) : 100;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
          Weight trend · {metric.label} ({metric.unit})
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--ui-tonal)', padding: 3, borderRadius: 999 }}>
          {METRICS.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedMetric(m.key)}
              style={{
                background: selectedMetric === m.key ? 'var(--ui-surface)' : 'transparent',
                color: selectedMetric === m.key ? 'var(--ui-text-primary)' : 'var(--ui-text-secondary)',
                border: 'none',
                borderRadius: 999,
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!showChart ? (
        <p style={{ fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>
          Log at least two measurements with {metric.label.toLowerCase()} data to see your trend graph.
        </p>
      ) : (
        <div data-testid="trend-chart" style={{ width: '100%', height: 160, outline: 'none' }}>
          <ResponsiveContainer width="100%" height={160} style={{ outline: 'none' }}>
            <AreaChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }}>
              <defs>
                <linearGradient id={`color-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metric.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={metric.color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--ui-text-secondary)' }}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                tickFormatter={(val: string) => val ? val.slice(0, 5) : val}
              />
              <YAxis
                domain={[minVal, maxVal]}
                tick={{ fontSize: 11, fill: 'var(--ui-text-secondary)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: 'var(--ui-outline-strong)', strokeDasharray: '3 3' }}
                contentStyle={{
                  background: 'var(--ui-surface)',
                  border: '1px solid var(--ui-outline)',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--ui-text-primary)',
                  boxShadow: 'var(--ui-card-shadow)',
                  outline: 'none',
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`${value ?? 0} ${metric.unit}`, metric.label]}
              />
              <Area
                type="monotone"
                dataKey={selectedMetric}
                stroke={metric.color}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#color-${metric.key})`}
                dot={{ r: 3, fill: metric.color, strokeWidth: 1, stroke: metric.color }}
                activeDot={{ r: 5, fill: metric.color, stroke: metric.color, strokeWidth: 1 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

