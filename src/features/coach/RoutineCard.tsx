import React, { useState } from 'react';
import { Play, Bookmark, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';
import { Chip } from '../../ui/primitives/Chip';
import { useStore } from '../../presentation/state/store';

export interface RoutineCardProps {
  routine: RoutineTemplate;
}

export const RoutineCard: React.FC<RoutineCardProps> = ({ routine }) => {
  const { startActiveSessionWithRoutine, saveRoutineTemplate, setIsGymModeOpen } = useStore();
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSave = async () => {
    if (saved || isSaving) return;
    setIsSaving(true);
    try {
      await saveRoutineTemplate({
        title: routine.title,
        description: routine.description,
        targetMuscles: routine.targetMuscles,
        exercises: routine.exercises,
      });
      setSaved(true);
    } catch (err) {
      console.error('Failed to save routine template:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStart = () => {
    startActiveSessionWithRoutine(routine);
    setIsGymModeOpen(true);
  };

  return (
    <Card style={{ margin: '8px 0', border: '1.5px solid var(--ui-outline)', background: 'var(--ui-surface)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Header Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              padding: '3px 10px',
              borderRadius: 'var(--ui-radius-pill)',
              background: 'var(--ui-tonal)',
              color: 'var(--ui-on-tonal)',
            }}
          >
            <Sparkles size={13} /> Rutina Sugerida por Coach
          </span>

          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ui-text-secondary)' }}>
            🏋️ {routine.exercises.length} ejercicios
          </span>
        </div>

        {/* Title & Description */}
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px 0', color: 'var(--ui-text-primary)' }}>
            {routine.title}
          </h3>
          {routine.description && (
            <p style={{ fontSize: 13, color: 'var(--ui-text-secondary)', margin: 0 }}>
              {routine.description}
            </p>
          )}
        </div>

        {/* Target Muscles Chips */}
        {routine.targetMuscles && routine.targetMuscles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {routine.targetMuscles.map((muscle, idx) => (
              <Chip key={idx} selected={false} style={{ fontSize: 11, padding: '2px 8px' }}>
                🎯 {muscle}
              </Chip>
            ))}
          </div>
        )}

        {/* Collapsible Exercise Toggle Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          style={{
            background: 'var(--ui-surface-dim)',
            border: '1px solid var(--ui-outline)',
            borderRadius: 'var(--ui-radius-md)',
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--ui-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            marginTop: 2,
          }}
        >
          <span>{isExpanded ? 'Ocultar detalle de ejercicios' : `Ver detalle (${routine.exercises.length} ejercicios)`}</span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Expanded Exercise Items List */}
        {isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            {routine.exercises.map((ex, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--ui-radius-md)',
                  background: 'var(--ui-bg)',
                  border: '1px solid var(--ui-outline)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'var(--ui-tonal)',
                      color: 'var(--ui-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 12,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, textTransform: 'capitalize', color: 'var(--ui-text-primary)' }}>
                      {ex.exerciseName}
                    </div>
                    {ex.notes && (
                      <div style={{ fontSize: 11, color: 'var(--ui-text-secondary)', fontStyle: 'italic' }}>
                        {ex.notes}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: 'var(--ui-primary)' }}>
                  {ex.targetSets} series {ex.targetReps ? `× ${ex.targetReps} reps` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6 }}>
          <Button
            variant="outlined"
            size="sm"
            onClick={handleSave}
            disabled={saved || isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saved ? <Check size={16} /> : <Bookmark size={16} />}
            {saved ? 'Guardada' : 'Guardar Template'}
          </Button>

          <Button
            variant="filled"
            size="sm"
            onClick={handleStart}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Play size={16} fill="currentColor" /> Aceptar y Entrenar
          </Button>
        </div>
      </div>
    </Card>
  );
};

