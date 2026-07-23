import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Ring } from '../../ui/primitives/Ring';

export interface EnergyScoreProps {
  score: number;        // 0-100
  label?: string;
  breakdown?: { label: string; value: number; weight: number }[];
}

/**
 * Samsung Health-style AI Energy Score card.
 * Shows a single daily wellness number (0-100) with a ring and optional breakdown.
 */
export const EnergyScore: React.FC<EnergyScoreProps> = ({ score, label = 'Energy Score', breakdown }) => {
  const clamped = Math.min(100, Math.max(0, Math.round(score)));
  const tone = clamped >= 75 ? 'Great' : clamped >= 50 ? 'Good' : clamped >= 30 ? 'Fair' : 'Low';
  const toneColor = clamped >= 75 ? 'var(--ui-success)' : clamped >= 50 ? 'var(--ui-primary)' : 'var(--ui-error)';

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Ring value={clamped} size={88} stroke={9} valueText={`${clamped}`} label={label} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: toneColor, marginTop: 2 }}>{tone}</div>
          {breakdown && breakdown.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {breakdown.map(b => (
                <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
                  <span style={{ color: 'var(--ui-text-secondary)' }}>{b.label}</span>
                  <span style={{ color: 'var(--ui-text-primary)' }}>{Math.round(b.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};