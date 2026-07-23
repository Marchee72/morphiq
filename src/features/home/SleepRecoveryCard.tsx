import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Moon, Sparkles } from 'lucide-react';

export interface SleepRecoveryCardProps {
  sleepHours?: number; // e.g. 7.67 (7h 40m)
  sleepScore?: number; // e.g. 84
  deepMinutes?: number; // e.g. 105
  remMinutes?: number; // e.g. 90
  lightMinutes?: number; // e.g. 255
  awakeMinutes?: number; // e.g. 10
}

export const SleepRecoveryCard: React.FC<SleepRecoveryCardProps> = ({
  sleepHours = 7.67,
  sleepScore = 84,
  deepMinutes = 105,
  remMinutes = 90,
  lightMinutes = 255,
  awakeMinutes = 10,
}) => {
  const hours = Math.floor(sleepHours);
  const mins = Math.round((sleepHours - hours) * 60);

  const totalSleepMins = deepMinutes + remMinutes + lightMinutes + awakeMinutes;
  const deepPct = Math.round((deepMinutes / totalSleepMins) * 100);
  const remPct = Math.round((remMinutes / totalSleepMins) * 100);
  const lightPct = Math.round((lightMinutes / totalSleepMins) * 100);
  const awakePct = 100 - (deepPct + remPct + lightPct);

  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--ui-radius-pill)',
            background: 'rgba(124, 77, 255, 0.14)',
            color: '#7C4DFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Moon size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
              Sleep & Recovery
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ui-text-primary)', letterSpacing: '-0.3px' }}>
              {hours}h {mins}m · Sleep Index
            </div>
          </div>
        </div>

        {/* Score Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 'var(--ui-radius-pill)',
          background: 'rgba(124, 77, 255, 0.12)',
          color: '#7C4DFF',
          fontWeight: 800,
          fontSize: 12,
        }}>
          <Sparkles size={13} /> {sleepScore} / 100
        </div>
      </div>

      {/* Sleep Stages Horizontal Bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--ui-text-secondary)', marginBottom: 6 }}>
          <span>Sleep Stages</span>
          <span>{totalSleepMins} mins total</span>
        </div>
        <div style={{ display: 'flex', width: '100%', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
          <div title="Deep" style={{ width: `${deepPct}%`, background: '#3F51B5' }} />
          <div title="REM" style={{ width: `${remPct}%`, background: '#7C4DFF' }} />
          <div title="Light" style={{ width: `${lightPct}%`, background: '#00BCD4' }} />
          <div title="Awake" style={{ width: `${awakePct}%`, background: 'var(--ui-outline-strong)' }} />
        </div>
      </div>

      {/* Stage Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, fontSize: 10, fontWeight: 700, textAlign: 'center', color: 'var(--ui-text-secondary)' }}>
        <div><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: '#3F51B5', marginRight: 4 }} />Deep {Math.floor(deepMinutes / 60)}h{deepMinutes % 60}m</div>
        <div><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: '#7C4DFF', marginRight: 4 }} />REM {Math.floor(remMinutes / 60)}h{remMinutes % 60}m</div>
        <div><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: '#00BCD4', marginRight: 4 }} />Light {Math.floor(lightMinutes / 60)}h{lightMinutes % 60}m</div>
        <div><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 999, background: 'var(--ui-outline-strong)', marginRight: 4 }} />Awake {awakeMinutes}m</div>
      </div>

      {/* Readiness Badge */}
      <div style={{
        marginTop: 14,
        padding: '8px 12px',
        borderRadius: 12,
        background: 'var(--ui-tonal)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--ui-text-primary)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span>💪</span>
        <span>Optimal recovery level — ready for intensive physical training today.</span>
      </div>
    </Card>
  );
};
