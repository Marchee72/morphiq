import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '../../ui/primitives/Button';

export interface GymDayNoteSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialFeeling?: 'feeling_100' | 'good' | 'sore' | 'pain' | 'low_energy';
  initialNotes?: string;
  onSave: (feelingTag?: 'feeling_100' | 'good' | 'sore' | 'pain' | 'low_energy', notes?: string) => void;
}

export const FEELING_OPTIONS = [
  { id: 'feeling_100', emoji: '🔥', label: '100% Strong', color: 'var(--ui-success)', bg: 'var(--ui-success-bg)' },
  { id: 'good', emoji: '⚡', label: 'Good / Normal', color: 'var(--ui-primary)', bg: 'var(--ui-tonal)' },
  { id: 'sore', emoji: '⚠️', label: 'Sore / Stiff', color: '#D97706', bg: 'rgba(217, 119, 6, 0.15)' },
  { id: 'pain', emoji: '🩹', label: 'Joint / Arm Pain', color: 'var(--ui-error)', bg: 'var(--ui-error-bg)' },
  { id: 'low_energy', emoji: '😴', label: 'Low Energy', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)' },
] as const;

export const GymDayNoteSheet: React.FC<GymDayNoteSheetProps> = ({
  isOpen,
  onClose,
  initialFeeling,
  initialNotes = '',
  onSave,
}) => {
  const [selectedTag, setSelectedTag] = useState<typeof initialFeeling>(initialFeeling);
  const [notesText, setNotesText] = useState(initialNotes);

  useEffect(() => {
    if (isOpen) {
      setSelectedTag(initialFeeling);
      setNotesText(initialNotes || '');
    }
  }, [isOpen, initialFeeling, initialNotes]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(selectedTag, notesText.trim() || undefined);
    onClose();
  };

  return (
    <div className="ui-sheet-overlay" onClick={onClose}>
      <div
        className="ui-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* One UI Handle Bar */}
        <div className="ui-sheet-handle" />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ui-primary)' }}>
              Session State & Notes
            </span>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--ui-text-primary)' }}>
              ¿Cómo te sientes hoy?
            </h3>
          </div>
          <button
            type="button"
            className="ui-icon-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Physical Feeling Tags (One UI Chips) */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', display: 'block', marginBottom: 10 }}>
            Estado físico / Energía
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FEELING_OPTIONS.map((opt) => {
              const isSelected = selectedTag === opt.id;
              return (
                <button
                  key={opt.id + opt.label}
                  type="button"
                  onClick={() => setSelectedTag(isSelected ? undefined : (opt.id as any))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 'var(--ui-radius-pill)',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'var(--ui-font)',
                    background: isSelected ? opt.color : 'var(--ui-surface-dim)',
                    color: isSelected ? '#FFFFFF' : 'var(--ui-text-primary)',
                    border: isSelected ? `1.5px solid ${opt.color}` : '1px solid var(--ui-outline)',
                    cursor: 'pointer',
                    transition: 'transform var(--ui-motion-fast), background-color var(--ui-motion-fast)',
                  }}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Notes Textarea */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', display: 'block', marginBottom: 8 }}>
            Nota del día de gym (opcional)
          </label>
          <textarea
            rows={3}
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Ej. Me duele un poco el brazo derecho, reducir peso en press. Siento buena energía para piernas."
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 'var(--ui-radius-md)',
              border: '1.5px solid var(--ui-outline-strong)',
              background: 'var(--ui-bg)',
              color: 'var(--ui-text-primary)',
              fontSize: 14,
              fontFamily: 'var(--ui-font)',
              resize: 'none',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <Button variant="tonal" onClick={onClose} style={{ flex: 1, minHeight: 44 }}>
            Cancelar
          </Button>
          <Button variant="filled" onClick={handleSave} style={{ flex: 1, minHeight: 44 }}>
            <Check size={16} /> Guardar Nota
          </Button>
        </div>
      </div>
    </div>
  );
};
