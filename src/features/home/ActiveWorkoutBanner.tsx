import React, { useState, useEffect, useMemo } from 'react';
import { Play, ArrowRight } from 'lucide-react';
import { useStore } from '../../presentation/state/store';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';

export const ActiveWorkoutBanner: React.FC = () => {
  const { activeSession, setIsGymModeOpen, setActiveTab } = useStore();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!activeSession) return;
    const updateSecs = () => {
      const elapsed = Math.floor((new Date().getTime() - new Date(activeSession.startTime).getTime()) / 1000);
      setSeconds(Math.max(0, elapsed));
    };
    updateSecs();
    const interval = setInterval(updateSecs, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const totalVolumeKg = useMemo(() => {
    if (!activeSession) return 0;
    return activeSession.sets.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
  }, [activeSession]);

  if (!activeSession) return null;

  const formatTime = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleOpenTracker = () => {
    setIsGymModeOpen(true);
  };

  const handleGoToGym = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab('gym');
  };

  return (
    <Card
      onClick={handleOpenTracker}
      style={{
        cursor: 'pointer',
        background: 'var(--ui-surface-dim)',
        border: '1px solid var(--ui-outline-strong)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Header Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '3px 10px',
            borderRadius: 'var(--ui-radius-pill)',
            background: 'var(--ui-success-bg)',
            color: 'var(--ui-success)',
          }}>
            <span className="ui-live-dot" />
            Entrenamiento en curso
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: 'var(--ui-primary)' }}>
            ⏱ {formatTime(seconds)}
          </span>
        </div>

        {/* Title & Body */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--ui-text-primary)' }}>
              {activeSession.workoutType || 'Strength Training'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 13, color: 'var(--ui-text-secondary)', fontWeight: 600 }}>
              <span>🏋️ {activeSession.sets.length} series</span>
              {totalVolumeKg > 0 && <span>💪 {totalVolumeKg.toLocaleString()} kg</span>}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Button
              variant="filled"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenTracker();
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Play size={14} fill="currentColor" /> Continuar
            </Button>
            <Button
              variant="tonal"
              size="sm"
              onClick={handleGoToGym}
              aria-label="Ir a Gym tab"
              title="Ir a Gym"
            >
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
