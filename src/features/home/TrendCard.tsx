import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { Card } from '../../ui/primitives/Card';

export interface TrendPoint { label: string; weight: number; }

export const TrendCard: React.FC<{ points: TrendPoint[] }> = ({ points }) => (
  <Card>
    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', marginBottom: 10 }}>Weight trend</div>
    {points.length < 2 ? (
      <p style={{ fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>Log at least two measurements to see your trend.</p>
    ) : (
      <div data-testid="trend-chart" style={{ width: '100%', height: 140 }}>
        <LineChart width={520} height={140} data={points} style={{ maxWidth: '100%' }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--ui-text-secondary)' }} axisLine={false} tickLine={false} />
          <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
          <Tooltip />
          <Line type="monotone" dataKey="weight" stroke="var(--ui-primary)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--ui-primary)' }} />
        </LineChart>
      </div>
    )}
  </Card>
);
