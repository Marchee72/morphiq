import React from 'react';
import { Footprints, Flame, Trophy } from 'lucide-react';
import { Card } from '../../ui/primitives/Card';

export interface StepGoalCardProps {
  currentSteps: number;
  targetGoal: number;
  streakDays: number;
  daysMetThisMonth: number;
  totalDaysInMonth: number;
}

export const StepGoalCard: React.FC<StepGoalCardProps> = ({
  currentSteps = 8420,
  targetGoal = 8000,
  streakDays = 6,
  daysMetThisMonth = 18,
  totalDaysInMonth = 22,
}) => {
  const percentage = Math.min(100, Math.round((currentSteps / targetGoal) * 100));

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--ui-radius-sm)',
            background: 'var(--ui-tonal)',
            color: 'var(--ui-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Footprints size={18} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
              SAMSUNG HEALTH STEPS
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ui-text-primary)', letterSpacing: '-0.5px' }}>
              {currentSteps.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>/ {targetGoal.toLocaleString()} steps</span>
            </div>
          </div>
        </div>

        <div style={{
          fontSize: 11,
          fontWeight: 800,
          padding: '4px 10px',
          borderRadius: 'var(--ui-radius-pill)',
          background: percentage >= 100 ? 'var(--ui-success-bg)' : 'var(--ui-tonal)',
          color: percentage >= 100 ? 'var(--ui-success)' : 'var(--ui-on-tonal)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <Flame size={13} /> {streakDays}-day streak
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div style={{
          height: 10,
          borderRadius: 'var(--ui-radius-pill)',
          background: 'var(--ui-surface-dim)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            height: '100%',
            width: `${percentage}%`,
            background: percentage >= 100 ? 'var(--ui-success)' : 'var(--ui-primary)',
            borderRadius: 'var(--ui-radius-pill)',
            transition: 'width var(--ui-motion)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>
          <span>{percentage}% of daily goal</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Trophy size={13} style={{ color: 'gold' }} /> {daysMetThisMonth}/{totalDaysInMonth} days met
          </span>
        </div>
      </div>
    </Card>
  );
};
