import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Target, TrendingDown, CheckCircle2 } from 'lucide-react';
import type { Measurement } from '../../core/entities/Measurement';

export interface BodyGoalProgressCardProps {
  measurements: Measurement[];
  targetWeightKg?: number;
  targetBodyFatPct?: number;
}

export const BodyGoalProgressCard: React.FC<BodyGoalProgressCardProps> = ({
  measurements,
  targetWeightKg = 74.0,
  targetBodyFatPct = 15.0,
}) => {
  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const initial = measurements.length > 0 ? measurements[0] : null;

  const currentWeight = latest?.weight ?? 78.4;
  const startWeight = initial?.weight ?? 82.0;

  const totalDistance = Math.abs(startWeight - targetWeightKg);
  const progressMade = Math.abs(startWeight - currentWeight);
  const pct = totalDistance > 0 ? Math.min(100, Math.max(0, Math.round((progressMade / totalDistance) * 100))) : 100;

  const remainingKg = Math.max(0, parseFloat((currentWeight - targetWeightKg).toFixed(2)));
  const currentFat = latest?.bodyFat ?? 18.5;
  const fatDiff = parseFloat((currentFat - targetBodyFatPct).toFixed(2));

  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--ui-radius-pill)',
            background: 'rgba(26, 127, 75, 0.14)',
            color: 'var(--ui-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Target size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
              Body Composition Target
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ui-text-primary)', letterSpacing: '-0.3px' }}>
              Target: {targetWeightKg.toFixed(2)} kg · {targetBodyFatPct.toFixed(2)}% Fat
            </div>
          </div>
        </div>

        <span style={{
          fontSize: 11,
          fontWeight: 800,
          padding: '4px 10px',
          borderRadius: 'var(--ui-radius-pill)',
          background: remainingKg <= 0 ? 'var(--ui-success-bg)' : 'var(--ui-tonal)',
          color: remainingKg <= 0 ? 'var(--ui-success)' : 'var(--ui-primary)',
        }}>
          {remainingKg <= 0 ? 'Target Achieved 🎉' : `${remainingKg.toFixed(2)} kg left`}
        </span>
      </div>

      {/* Visual Weight Progress Timeline Bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--ui-text-secondary)', marginBottom: 6 }}>
          <span>Start: {startWeight.toFixed(2)} kg</span>
          <span>Current: {currentWeight.toFixed(2)} kg ({pct}%)</span>
          <span>Goal: {targetWeightKg.toFixed(2)} kg</span>
        </div>
        <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'var(--ui-tonal)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'var(--ui-primary)', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Metric Target Grid Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        <div style={{
          padding: 10,
          borderRadius: 12,
          background: 'var(--ui-tonal)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <TrendingDown size={18} color="var(--ui-primary)" />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)' }}>Weight Drop</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ui-text-primary)' }}>
              -{progressMade.toFixed(2)} kg achieved
            </div>
          </div>
        </div>

        <div style={{
          padding: 10,
          borderRadius: 12,
          background: 'var(--ui-tonal)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <CheckCircle2 size={18} color="var(--ui-success)" />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)' }}>Body Fat Goal</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ui-text-primary)' }}>
              {fatDiff <= 0 ? 'Goal Reached' : `${fatDiff.toFixed(2)}% to goal`}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
