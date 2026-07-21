import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Ring } from '../../ui/primitives/Ring';

export interface CompRingsCardProps { bodyFatPct: number; muscleMassKg: number; }

export const CompRingsCard: React.FC<CompRingsCardProps> = ({ bodyFatPct, muscleMassKg }) => {
  if (bodyFatPct === 0 && muscleMassKg === 0) {
    return (
      <Card>
        <p style={{ fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>
          No body composition data — sync from Samsung Health to see body fat and muscle.
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: 16 }}>
        <Ring value={(bodyFatPct / 50) * 100} label="Body fat" valueText={`${bodyFatPct}%`} />
        <Ring value={(muscleMassKg / 60) * 100} label="Muscle" valueText={`${muscleMassKg}`} />
      </div>
    </Card>
  );
};
