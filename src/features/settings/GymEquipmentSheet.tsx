import React, { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { Sheet } from '../../ui/primitives/Sheet';
import { Chip } from '../../ui/primitives/Chip';
import { Button } from '../../ui/primitives/Button';
import { ALL_EQUIPMENT } from './gymEquipmentData';

interface Preset {
  label: string;
  equipment: string[];
}

const PRESETS: Preset[] = [
  {
    label: 'Gimnasio Comercial Completo',
    equipment: ALL_EQUIPMENT.map(e => e.id),
  },
  {
    label: 'Gimnasio en Casa',
    equipment: ['dumbbell', 'body weight', 'band', 'kettlebell'],
  },
];

export interface GymEquipmentSheetProps {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onSave: (equipment: string[]) => void;
}

export const GymEquipmentSheet: React.FC<GymEquipmentSheetProps> = ({
  open,
  onClose,
  selected,
  onSave,
}) => {
  const [localSelected, setLocalSelected] = useState<string[]>(selected);

  // Reset local state when sheet opens with new props
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setLocalSelected(selected);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  const toggle = (id: string) => {
    setLocalSelected(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id],
    );
  };

  const applyPreset = (equipment: string[]) => {
    setLocalSelected([...equipment]);
  };

  const handleSave = () => {
    onSave(localSelected);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Equipamiento de Gimnasio">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px 20px' }}>

        {/* Presets */}
        <div>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ui-text-secondary)',
            display: 'block',
            marginBottom: 8,
          }}>
            PRESETS
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRESETS.map(p => (
              <Chip
                key={p.label}
                onClick={() => applyPreset(p.equipment)}
                style={{ cursor: 'pointer', fontSize: 12 }}
              >
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Equipment Selection */}
        <div>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ui-text-secondary)',
            display: 'block',
            marginBottom: 8,
          }}>
            EQUIPAMIENTO DISPONIBLE ({localSelected.length} seleccionados)
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_EQUIPMENT.map(eq => (
              <Chip
                key={eq.id}
                selected={localSelected.includes(eq.id)}
                onClick={() => toggle(eq.id)}
                style={{ cursor: 'pointer', fontSize: 12 }}
              >
                {localSelected.includes(eq.id) ? '✓ ' : ''}{eq.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Summary & Save */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 0 0',
          borderTop: '1px solid var(--ui-outline)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ui-text-secondary)' }}>
            <Dumbbell size={16} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {localSelected.length} equipos activos
            </span>
          </div>
          <Button variant="filled" onClick={handleSave}>
            Guardar
          </Button>
        </div>

      </div>
    </Sheet>
  );
};
