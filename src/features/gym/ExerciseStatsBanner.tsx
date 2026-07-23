import React from 'react';
import { Trophy, History, Link2, Unlink, RefreshCw } from 'lucide-react';
import type { HistoricalExerciseStats } from '../../presentation/state/store';
import { Card } from '../../ui/primitives/Card';

export interface ExerciseStatsBannerProps {
  exerciseName: string;
  stats: HistoricalExerciseStats | null;
  biseriePartnerName?: string;
  isBiserieActive?: boolean;
  onToggleBiserieClick: () => void;
  onSwitchToBiseriePartner?: () => void;
  onChangeExerciseClick?: () => void;
}

export const ExerciseStatsBanner: React.FC<ExerciseStatsBannerProps> = ({
  exerciseName,
  stats,
  biseriePartnerName,
  isBiserieActive,
  onToggleBiserieClick,
  onSwitchToBiseriePartner,
  onChangeExerciseClick,
}) => {
  return (
    <Card style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Exercise Title Header & Biserie Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
            Ejercicio Activo
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, textTransform: 'capitalize', color: 'var(--ui-text-primary)' }}>
              {exerciseName}
            </h2>
            {onChangeExerciseClick && (
              <button
                type="button"
                onClick={onChangeExerciseClick}
                title="Cambiar ejercicio de la biblioteca"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 'var(--ui-radius-pill)',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--ui-font)',
                  background: 'var(--ui-surface-dim)',
                  color: 'var(--ui-primary)',
                  border: '1px solid var(--ui-outline)',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={12} /> Cambiar
              </button>
            )}
          </div>
        </div>

        {/* Link Biserie Button */}
        <button
          type="button"
          onClick={onToggleBiserieClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 'var(--ui-radius-pill)',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'var(--ui-font)',
            background: isBiserieActive ? 'rgba(139, 92, 246, 0.18)' : 'var(--ui-surface-dim)',
            color: isBiserieActive ? '#8B5CF6' : 'var(--ui-text-secondary)',
            border: isBiserieActive ? '1.5px solid #8B5CF6' : '1px solid var(--ui-outline)',
            cursor: 'pointer',
            transition: 'all var(--ui-motion-fast)',
          }}
        >
          {isBiserieActive ? (
            <>
              <Unlink size={14} /> Biserie Activa
            </>
          ) : (
            <>
              <Link2 size={14} /> Vincular Biserie
            </>
          )}
        </button>
      </div>

      {/* Superset Quick Switcher if biserie is active */}
      {isBiserieActive && biseriePartnerName && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            borderRadius: 'var(--ui-radius-md)',
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: '#8B5CF6' }}>
            ⚡ Biserie con: <strong>{biseriePartnerName}</strong>
          </span>

          {onSwitchToBiseriePartner && (
            <button
              type="button"
              onClick={onSwitchToBiseriePartner}
              style={{
                background: '#8B5CF6',
                color: '#FFFFFF',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 'var(--ui-radius-pill)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ir a {biseriePartnerName}
            </button>
          )}
        </div>
      )}

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
            <strong style={{ fontSize: 14, fontWeight: 800, color: 'var(--ui-text-primary)' }}>
              {stats && stats.prWeight > 0 ? `${stats.prWeight} kg × ${stats.prReps} reps` : 'Sin registro'}
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
              {stats && stats.lastMaxWeight != null ? (
                <>
                  Max <span style={{ color: 'var(--ui-primary)' }}>{stats.lastMaxWeight}kg</span> | Min <span style={{ color: 'var(--ui-text-secondary)' }}>{stats.lastMinWeight}kg</span>
                </>
              ) : (
                'Sin historial'
              )}
            </strong>
          </div>
        </div>
      </div>
    </Card>
  );
};
