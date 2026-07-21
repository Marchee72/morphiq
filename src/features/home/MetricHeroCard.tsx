import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';

export interface MetricHeroCardProps { latestWeightKg: number | null; deltaKg: number | null; onLogWeight: () => void; }

export const MetricHeroCard: React.FC<MetricHeroCardProps> = ({ latestWeightKg, deltaKg, onLogWeight }) => (
  <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>Weight</div>
        {latestWeightKg !== null ? (
          <>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>
              <span>{latestWeightKg}</span> <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>kg</span>
            </div>
            {deltaKg !== null && (
              <span style={{ display: 'inline-block', marginTop: 8, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: deltaKg <= 0 ? 'var(--ui-success-bg)' : 'var(--ui-error-bg)', color: deltaKg <= 0 ? 'var(--ui-success)' : 'var(--ui-error)' }}>
                {deltaKg > 0 ? '+' : ''}{deltaKg} this week
              </span>
            )}
          </>
        ) : (
          <p style={{ marginTop: 8, fontSize: 13.5, color: 'var(--ui-text-secondary)', maxWidth: 260 }}>
            No measurements yet — sync from Samsung Health or log your weight.
          </p>
        )}
      </div>
      <Button variant="tonal" onClick={onLogWeight}>Log weight</Button>
    </div>
  </Card>
);
