import { useState } from 'react';
import type { UserProfile } from '../../core/entities/UserProfile';
import { Sheet } from '../../ui/primitives/Sheet';
import { Button } from '../../ui/primitives/Button';

export interface ProfileEditSheetProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSave: (updated: UserProfile) => Promise<void>;
}

export function ProfileEditSheet({ open, onClose, profile, onSave }: ProfileEditSheetProps) {
  const [prevProfile, setPrevProfile] = useState<UserProfile | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  const [name, setName] = useState('');
  const [height, setHeight] = useState('175');
  const [targetWeight, setTargetWeight] = useState('70');
  const [targetCalories, setTargetCalories] = useState('2200');
  const [targetProtein, setTargetProtein] = useState('150');
  const [isSaving, setIsSaving] = useState(false);

  if (profile !== prevProfile || open !== prevOpen) {
    setPrevProfile(profile);
    setPrevOpen(open);
    if (profile && open) {
      setName(profile.name || '');
      setHeight(profile.height ? String(profile.height) : '175');
      setTargetWeight(profile.targetWeight ? String(profile.targetWeight) : '');
      setTargetCalories(profile.targetCalories ? String(profile.targetCalories) : '');
      setTargetProtein(profile.targetProtein ? String(profile.targetProtein) : '');
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);
    try {
      await onSave({
        ...profile,
        name: name.trim() || profile.name,
        height: Number(height) || profile.height,
        targetWeight: targetWeight ? Number(targetWeight) : undefined,
        targetCalories: targetCalories ? Number(targetCalories) : undefined,
        targetProtein: targetProtein ? Number(targetProtein) : undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Editar Perfil">
      <form onSubmit={handleSubmit} style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)', marginBottom: 4 }}>
            Nombre completo
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--ui-radius-card)',
              border: '1px solid var(--ui-border)',
              background: 'var(--ui-surface)',
              color: 'var(--ui-text-primary)',
              fontSize: 14,
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)', marginBottom: 4 }}>
              Estatura (cm)
            </label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--ui-radius-card)',
                border: '1px solid var(--ui-border)',
                background: 'var(--ui-surface)',
                color: 'var(--ui-text-primary)',
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)', marginBottom: 4 }}>
              Meta de peso (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--ui-radius-card)',
                border: '1px solid var(--ui-border)',
                background: 'var(--ui-surface)',
                color: 'var(--ui-text-primary)',
                fontSize: 14,
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)', marginBottom: 4 }}>
              Meta de Calorías (kcal)
            </label>
            <input
              type="number"
              value={targetCalories}
              onChange={(e) => setTargetCalories(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--ui-radius-card)',
                border: '1px solid var(--ui-border)',
                background: 'var(--ui-surface)',
                color: 'var(--ui-text-primary)',
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)', marginBottom: 4 }}>
              Meta de Proteína (g)
            </label>
            <input
              type="number"
              value={targetProtein}
              onChange={(e) => setTargetProtein(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--ui-radius-card)',
                border: '1px solid var(--ui-border)',
                background: 'var(--ui-surface)',
                color: 'var(--ui-text-primary)',
                fontSize: 14,
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Button variant="ghost" style={{ flex: 1 }} type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="filled" style={{ flex: 1 }} type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
