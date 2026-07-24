import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Minus, Trash2, Dumbbell, Repeat } from 'lucide-react';
import { Button } from '../../ui/primitives/Button';

export interface SetAdjustSheetProps {
  isOpen: boolean;
  onClose: () => void;
  setNumber: number;
  exerciseName: string;
  initialWeight?: number;
  initialReps?: number;
  onSave: (weight?: number, reps?: number, isCompleted?: boolean) => void;
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

  const handleSaveAndComplete = () => {
    onSave(weight, reps, true);
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
        style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'var(--ui-font)' }}
      >
        <div className="ui-sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ui-primary)' }}>
              Cargar Serie
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, textTransform: 'capitalize', color: 'var(--ui-text-primary)' }}>
              Serie #{setNumber} — {exerciseName}
            </h3>
          </div>
          <button type="button" className="ui-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Peso Direct Input & Quick Increment Chips */}
        <div style={{ background: 'var(--ui-surface-dim)', padding: 16, borderRadius: 'var(--ui-radius-card)', border: '1px solid var(--ui-outline)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dumbbell size={15} style={{ color: 'var(--ui-primary)' }} /> Peso de Carga (kg)
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ui-primary)' }}>
              Toca para escribir
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={weight === 0 ? '' : weight}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                setWeight(isNaN(val) ? 0 : val);
              }}
              placeholder="0.00"
              style={{
                width: '100%',
                maxWidth: 160,
                height: 52,
                textAlign: 'center',
                borderRadius: 'var(--ui-radius-md)',
                border: '2px solid var(--ui-primary)',
                background: 'var(--ui-surface)',
                fontSize: 28,
                fontWeight: 800,
                color: 'var(--ui-text-primary)',
                fontFamily: 'var(--ui-font)',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ui-text-secondary)' }}>kg</span>
          </div>

          {/* Quick Increment Chips */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
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
            {[1.25, 2.5, 5, 10].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setWeight((prev) => Math.max(0, Number((prev + step).toFixed(2))))}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--ui-radius-pill)',
                  border: '1px solid var(--ui-outline)',
                  background: 'var(--ui-surface)',
                  color: 'var(--ui-primary)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'var(--ui-font)',
                  flexShrink: 0,
                }}
              >
                +{step} kg
              </button>
            ))}
          </div>
        </div>

        {/* Repeticiones Direct Input & Controls */}
        <div style={{ background: 'var(--ui-surface-dim)', padding: 16, borderRadius: 'var(--ui-radius-card)', border: '1px solid var(--ui-outline)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Repeat size={15} style={{ color: 'var(--ui-primary)' }} /> Repeticiones
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => setReps((prev) => Math.max(1, prev - 1))}
              style={{
                width: 48,
                height: 48,
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
              <Minus size={22} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                value={reps === 0 ? '' : reps}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                  setReps(isNaN(val) ? 0 : val);
                }}
                style={{
                  width: 90,
                  height: 48,
                  textAlign: 'center',
                  borderRadius: 'var(--ui-radius-md)',
                  border: '2px solid var(--ui-primary)',
                  background: 'var(--ui-surface)',
                  fontSize: 22,
                  fontWeight: 800,
                  color: 'var(--ui-text-primary)',
                  fontFamily: 'var(--ui-font)',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ui-text-secondary)' }}>reps</span>
            </div>

            <button
              type="button"
              onClick={() => setReps((prev) => prev + 1)}
              style={{
                width: 48,
                height: 48,
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
              <Plus size={22} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {onDelete && (
            <Button
              variant="outlined"
              onClick={handleDelete}
              style={{ flex: 1, minHeight: 48, borderRadius: 'var(--ui-radius-pill)', color: 'var(--ui-error)', borderColor: 'var(--ui-error)' }}
            >
              <Trash2 size={18} /> Borrar
            </Button>
          )}
          <Button
            variant="filled"
            onClick={handleSaveAndComplete}
            style={{
              flex: onDelete ? 2 : 1,
              minHeight: 48,
              borderRadius: 'var(--ui-radius-pill)',
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            <Check size={18} /> Completar Serie
          </Button>
        </div>
      </div>
    </div>
  );
};
