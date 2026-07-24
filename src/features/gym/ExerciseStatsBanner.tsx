import React from 'react';
import { Trophy, History, RefreshCw } from 'lucide-react';
import type { HistoricalExerciseStats } from '../../presentation/state/store';

export interface ExerciseStatsBannerProps {
  exerciseName: string;
  stats: HistoricalExerciseStats | null;
  onChangeExerciseClick?: () => void;
}

export const ExerciseStatsBanner: React.FC<ExerciseStatsBannerProps> = ({
  exerciseName,
  stats,
  onChangeExerciseClick,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Exercise Title Header & Change Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
            Ejercicio Activo
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 0 0', textTransform: 'capitalize', color: 'var(--ui-text-primary)' }}>
            {exerciseName}
          </h2>
        </div>

        {onChangeExerciseClick && (
          <button
            type="button"
            onClick={onChangeExerciseClick}
            title="Cambiar ejercicio de la biblioteca"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 'var(--ui-radius-pill)',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--ui-font)',
              background: 'var(--ui-surface-dim)',
              color: 'var(--ui-primary)',
              border: '1px solid var(--ui-outline)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Cambiar
          </button>
        )}
      </div>

      {/* Intel Stats Strip: PR & Last Session Min/Max */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Personal Record Badge */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--ui-radius-md)',
            background: 'var(--ui-surface-dim)',
            border: '1px solid var(--ui-outline)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              background: 'rgba(245, 158, 11, 0.18)',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Trophy size={18} />
          </div>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', display: 'block' }}>
              Récord Personal (PR)
            </span>
            <strong style={{ fontSize: 13, fontWeight: 800, color: 'var(--ui-text-primary)' }}>
              {stats && stats.prWeight > 0 ? `${stats.prWeight.toFixed(2)} kg × ${stats.prReps}` : 'Sin registro'}
            </strong>
          </div>
        </div>

        {/* Last Session Stats */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--ui-radius-md)',
            background: 'var(--ui-surface-dim)',
            border: '1px solid var(--ui-outline)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              background: 'var(--ui-tonal)',
              color: 'var(--ui-on-tonal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <History size={18} />
          </div>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', display: 'block' }}>
              Última Sesión
            </span>
            <strong style={{ fontSize: 13, fontWeight: 800, color: 'var(--ui-text-primary)' }}>
              {stats && stats.lastMaxWeight != null && stats.lastMinWeight != null ? (
                <>
                  Max <span style={{ color: 'var(--ui-primary)' }}>{stats.lastMaxWeight.toFixed(2)}kg</span> | Min <span style={{ color: 'var(--ui-text-secondary)' }}>{stats.lastMinWeight.toFixed(2)}kg</span>
                </>
              ) : (
                'Sin historial'
              )}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
