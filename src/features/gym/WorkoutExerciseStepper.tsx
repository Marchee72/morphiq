import React from 'react';
import { Plus, Link2, CheckCircle2 } from 'lucide-react';
import type { ActiveSessionExercise } from '../../presentation/state/store';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';

export interface WorkoutExerciseStepperProps {
  exercises: ActiveSessionExercise[];
  activeExerciseIndex: number;
  onSelectExerciseIndex: (index: number) => void;
  onAddExerciseClick: () => void;
  sets: Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'>[];
}

export const WorkoutExerciseStepper: React.FC<WorkoutExerciseStepperProps> = ({
  exercises,
  activeExerciseIndex,
  onSelectExerciseIndex,
  onAddExerciseClick,
  sets,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        overflowX: 'auto',
        padding: '4px 2px 10px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {exercises.map((ex, idx) => {
        const isSelected = activeExerciseIndex === idx;
        const loggedSets = sets.filter(
          (s) => s && s.exerciseName && ex.exerciseName && s.exerciseName.trim().toLowerCase() === ex.exerciseName.trim().toLowerCase() && s.isCompleted
        ).length;
        const isFullyDone = loggedSets >= ex.targetSets;
        const isBiserie = Boolean(ex.biserieGroupId);

        return (
          <button
            key={ex.id || idx}
            type="button"
            onClick={() => onSelectExerciseIndex(idx)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 'var(--ui-radius-pill)',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--ui-font)',
              fontSize: 13,
              fontWeight: isSelected ? 800 : 600,
              background: isSelected
                ? 'var(--ui-tonal)'
                : isFullyDone
                ? 'var(--ui-success-bg)'
                : 'var(--ui-surface-dim)',
              color: isSelected
                ? 'var(--ui-on-tonal)'
                : isFullyDone
                ? 'var(--ui-success)'
                : 'var(--ui-text-primary)',
              border: isSelected
                ? '1.5px solid var(--ui-primary)'
                : isBiserie
                ? '1.5px dashed #8B5CF6'
                : '1px solid var(--ui-outline)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all var(--ui-motion-fast)',
            }}
          >
            {/* Index badge */}
            <span style={{ fontSize: 12, opacity: 0.85 }}>#{idx + 1}</span>

            {/* Exercise name */}
            <span style={{ textTransform: 'capitalize' }}>{ex.exerciseName}</span>

            {/* Biserie indicator */}
            {isBiserie && (
              <span title="Parte de una Biserie" style={{ display: 'inline-flex', color: '#8B5CF6' }}>
                <Link2 size={13} />
              </span>
            )}

            {/* Completed badge */}
            {isFullyDone ? (
              <CheckCircle2 size={14} style={{ color: 'var(--ui-success)' }} />
            ) : (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: isSelected ? 'var(--ui-primary)' : 'var(--ui-outline-strong)',
                  color: isSelected ? '#FFFFFF' : 'var(--ui-text-secondary)',
                }}
              >
                {loggedSets}/{ex.targetSets}
              </span>
            )}
          </button>
        );
      })}

      {/* Add exercise button */}
      <button
        type="button"
        onClick={onAddExerciseClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 'var(--ui-radius-pill)',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--ui-font)',
          fontSize: 13,
          fontWeight: 700,
          background: 'var(--ui-surface)',
          color: 'var(--ui-primary)',
          border: '1.5px dashed var(--ui-primary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Plus size={15} /> Ejercicio
      </button>
    </div>
  );
};
