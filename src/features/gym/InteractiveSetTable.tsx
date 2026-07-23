import React from 'react';
import { Check, Plus, Trash2, Minus } from 'lucide-react';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { HistoricalExerciseStats } from '../../presentation/state/store';
import { Card } from '../../ui/primitives/Card';

export interface InteractiveSetTableProps {
  exerciseName: string;
  targetSets?: number;
  targetReps?: number;
  sets: Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'>[];
  historicalStats: HistoricalExerciseStats | null;
  onUpdateSet: (index: number, weight?: number, reps?: number, isCompleted?: boolean, notes?: string) => void;
  onAddSet: () => void;
  onDeleteSet: (index: number) => void;
  onToggleCompleteSet: (index: number) => void;
}

export const InteractiveSetTable: React.FC<InteractiveSetTableProps> = ({
  exerciseName,
  targetSets = 3,
  targetReps,
  sets,
  historicalStats,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onToggleCompleteSet,
}) => {
  // Filter sets belonging to this exercise
  const exerciseSets = sets
    .map((set, originalIndex) => ({ set, originalIndex }))
    .filter(({ set }) => set.exerciseName.trim().toLowerCase() === exerciseName.trim().toLowerCase());

  // Determine ghost values from historical sets if available
  const getGhostValue = (setIdx: number) => {
    if (historicalStats?.lastSets && historicalStats.lastSets[setIdx]) {
      return historicalStats.lastSets[setIdx];
    }
    return null;
  };

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
          Series & Cargas ({exerciseSets.length} / {targetSets} Objetivo)
        </div>
        {targetReps && (
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ui-primary)' }}>
            🎯 Target: {targetReps} reps
          </span>
        )}
      </div>

      {/* Set Rows Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1.2fr 1.2fr 48px 36px',
          gap: 8,
          alignItems: 'center',
          padding: '0 4px',
          fontSize: 11,
          fontWeight: 800,
          textTransform: 'uppercase',
          color: 'var(--ui-text-secondary)',
        }}
      >
        <span>Set</span>
        <span>Peso (kg)</span>
        <span>Reps</span>
        <span style={{ textAlign: 'center' }}>Estado</span>
        <span />
      </div>

      {/* Set Rows */}
      {exerciseSets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--ui-text-secondary)', fontSize: 13 }}>
          No hay series registradas aún. Presiona "+ Agregar Serie" para comenzar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exerciseSets.map(({ set, originalIndex }, setIdx) => {
            const ghost = getGhostValue(setIdx);
            const isDone = Boolean(set.isCompleted);

            return (
              <div
                key={originalIndex}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1.2fr 1.2fr 48px 36px',
                  gap: 8,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 'var(--ui-radius-md)',
                  background: isDone ? 'var(--ui-success-bg)' : 'var(--ui-surface-dim)',
                  border: isDone ? '1.5px solid var(--ui-success)' : '1px solid var(--ui-outline)',
                  transition: 'all var(--ui-motion-fast)',
                }}
              >
                {/* Set Number */}
                <div style={{ fontSize: 14, fontWeight: 800, color: isDone ? 'var(--ui-success)' : 'var(--ui-primary)' }}>
                  #{setIdx + 1}
                </div>

                {/* Weight Input with +/- 2.5kg */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    aria-label="Disminuir 2.5 kg"
                    onClick={() => {
                      const current = set.weight ?? ghost?.weight ?? 0;
                      const next = Math.max(0, Number((current - 2.5).toFixed(1)));
                      onUpdateSet(originalIndex, next, set.reps, set.isCompleted, set.notes);
                    }}
                    style={{
                      width: 24,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid var(--ui-outline-strong)',
                      background: 'var(--ui-bg)',
                      color: 'var(--ui-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <Minus size={12} />
                  </button>

                  <input
                    type="number"
                    inputMode="decimal"
                    value={set.weight ?? ''}
                    placeholder={ghost ? String(ghost.weight) : '0'}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      onUpdateSet(originalIndex, val, set.reps, set.isCompleted, set.notes);
                    }}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      height: 34,
                      padding: '0 6px',
                      borderRadius: 8,
                      border: '1px solid var(--ui-outline)',
                      background: 'var(--ui-bg)',
                      color: 'var(--ui-text-primary)',
                      fontSize: 14,
                      fontWeight: 700,
                      textAlign: 'center',
                      fontFamily: 'var(--ui-font)',
                    }}
                  />

                  <button
                    type="button"
                    aria-label="Aumentar 2.5 kg"
                    onClick={() => {
                      const current = set.weight ?? ghost?.weight ?? 0;
                      const next = Number((current + 2.5).toFixed(1));
                      onUpdateSet(originalIndex, next, set.reps, set.isCompleted, set.notes);
                    }}
                    style={{
                      width: 24,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid var(--ui-outline-strong)',
                      background: 'var(--ui-bg)',
                      color: 'var(--ui-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Reps Input with +/- 1 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    aria-label="Disminuir 1 rep"
                    onClick={() => {
                      const current = set.reps ?? targetReps ?? ghost?.reps ?? 10;
                      const next = Math.max(1, current - 1);
                      onUpdateSet(originalIndex, set.weight, next, set.isCompleted, set.notes);
                    }}
                    style={{
                      width: 24,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid var(--ui-outline-strong)',
                      background: 'var(--ui-bg)',
                      color: 'var(--ui-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <Minus size={12} />
                  </button>

                  <input
                    type="number"
                    inputMode="numeric"
                    value={set.reps ?? ''}
                    placeholder={targetReps ? String(targetReps) : ghost ? String(ghost.reps) : '10'}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      onUpdateSet(originalIndex, set.weight, val, set.isCompleted, set.notes);
                    }}
                    style={{
                      width: '100%',
                      minWidth: 0,
                      height: 34,
                      padding: '0 6px',
                      borderRadius: 8,
                      border: '1px solid var(--ui-outline)',
                      background: 'var(--ui-bg)',
                      color: 'var(--ui-text-primary)',
                      fontSize: 14,
                      fontWeight: 700,
                      textAlign: 'center',
                      fontFamily: 'var(--ui-font)',
                    }}
                  />

                  <button
                    type="button"
                    aria-label="Aumentar 1 rep"
                    onClick={() => {
                      const current = set.reps ?? targetReps ?? ghost?.reps ?? 10;
                      const next = current + 1;
                      onUpdateSet(originalIndex, set.weight, next, set.isCompleted, set.notes);
                    }}
                    style={{
                      width: 24,
                      height: 32,
                      borderRadius: 8,
                      border: '1px solid var(--ui-outline-strong)',
                      background: 'var(--ui-bg)',
                      color: 'var(--ui-text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Completion Checkmark Action */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    aria-label={isDone ? 'Marcar incompleto' : 'Completar serie'}
                    onClick={() => onToggleCompleteSet(originalIndex)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 'var(--ui-radius-pill)',
                      border: 'none',
                      background: isDone ? 'var(--ui-success)' : 'var(--ui-outline-strong)',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'transform var(--ui-motion-fast), background-color var(--ui-motion-fast)',
                    }}
                  >
                    <Check size={18} />
                  </button>
                </div>

                {/* Delete Set */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    aria-label="Eliminar serie"
                    onClick={() => onDeleteSet(originalIndex)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--ui-error)',
                      cursor: 'pointer',
                      padding: 4,
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Set Button */}
      <button
        type="button"
        onClick={onAddSet}
        style={{
          width: '100%',
          minHeight: 44,
          borderRadius: 'var(--ui-radius-pill)',
          border: '1.5px dashed var(--ui-primary)',
          background: 'var(--ui-surface)',
          color: 'var(--ui-primary)',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--ui-font)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        <Plus size={16} /> Agregar Serie
      </button>
    </Card>
  );
};
