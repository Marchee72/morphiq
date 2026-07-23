import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '../../ui/primitives/Button';

export interface SetAdjustSheetProps {
  isOpen: boolean;
  onClose: () => void;
  setNumber: number;
  exerciseName: string;
  initialWeight?: number;
  initialReps?: number;
  onSave: (weight?: number, reps?: number) => void;
  onDelete?: () => void;
}

export const SetAdjustSheet: React.FC<SetAdjustSheetProps> = ({
  isOpen,
  onClose,
  setNumber,
  exerciseName,
  initialWeight = 0,
  initialReps = 10,
  onSave,
  onDelete,
}) => {
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);

  useEffect(() => {
    if (isOpen) {
      setWeight(initialWeight || 0);
      setReps(initialReps || 10);
    }
  }, [isOpen, initialWeight, initialReps]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(weight, reps);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  return (
    <div className="ui-sheet-overlay" onClick={onClose}>
      <div
        className="ui-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div className="ui-sheet-handle" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ui-primary)' }}>
              Ajuste de Carga
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: 'capitalize', color: 'var(--ui-text-primary)' }}>
              Serie #{setNumber} — {exerciseName}
            </h3>
          </div>
          <button type="button" className="ui-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Weight Selector */}
        <div style={{ background: 'var(--ui-surface-dim)', padding: 14, borderRadius: 'var(--ui-radius-card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)' }}>
              Peso Carga
            </span>
            <strong style={{ fontSize: 22, fontWeight: 800, color: 'var(--ui-primary)' }}>
              {weight === 0 ? 'Sin Peso (0 kg)' : `${weight} kg`}
            </strong>
          </div>

          {/* Quick Increment & Bodyweight Chips */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            <button
              type="button"
              onClick={() => setWeight(0)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--ui-radius-pill)',
                border: weight === 0 ? '1.5px solid var(--ui-primary)' : '1px solid var(--ui-outline)',
                background: weight === 0 ? 'var(--ui-tonal)' : 'var(--ui-surface)',
                color: weight === 0 ? 'var(--ui-on-tonal)' : 'var(--ui-text-primary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--ui-font)',
                flexShrink: 0,
              }}
            >
              🏋️ Sin Peso (0 kg)
            </button>
            {[-5, -2.5, 2.5, 5, 10].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setWeight((prev) => Math.max(0, Number((prev + step).toFixed(1))))}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--ui-radius-pill)',
                  border: '1px solid var(--ui-outline)',
                  background: 'var(--ui-surface)',
                  color: step > 0 ? 'var(--ui-primary)' : 'var(--ui-text-secondary)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--ui-font)',
                  flexShrink: 0,
                }}
              >
                {step > 0 ? `+${step}` : step} kg
              </button>
            ))}
          </div>
        </div>

        {/* Reps Selector */}
        <div style={{ background: 'var(--ui-surface-dim)', padding: 14, borderRadius: 'var(--ui-radius-card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)' }}>
              Repeticiones
            </span>
            <strong style={{ fontSize: 24, fontWeight: 800, color: 'var(--ui-primary)' }}>
              {reps} reps
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setReps((prev) => Math.max(1, prev - 1))}
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--ui-radius-pill)',
                border: '1px solid var(--ui-outline-strong)',
                background: 'var(--ui-surface)',
                color: 'var(--ui-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Minus size={20} />
            </button>

            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(Number(e.target.value))}
              style={{
                width: 70,
                height: 44,
                textAlign: 'center',
                borderRadius: 'var(--ui-radius-md)',
                border: '1.5px solid var(--ui-primary)',
                background: 'var(--ui-surface)',
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--ui-text-primary)',
                fontFamily: 'var(--ui-font)',
              }}
            />

            <button
              type="button"
              onClick={() => setReps((prev) => prev + 1)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--ui-radius-pill)',
                border: '1px solid var(--ui-outline-strong)',
                background: 'var(--ui-surface)',
                color: 'var(--ui-text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {onDelete && (
            <Button
              variant="outlined"
              onClick={handleDelete}
              style={{ flex: 1, minHeight: 46, color: 'var(--ui-error)', borderColor: 'var(--ui-error)' }}
            >
              <Trash2 size={18} /> Borrar Serie
            </Button>
          )}
          <Button variant="filled" onClick={handleSave} style={{ flex: onDelete ? 2 : 1, minHeight: 46 }}>
            <Check size={18} /> Guardar Serie
          </Button>
        </div>
      </div>
    </div>
  );
};
