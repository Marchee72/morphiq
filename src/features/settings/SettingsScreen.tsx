import React from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../../presentation/state/store';
import { AppBar } from '../../ui/primitives/AppBar';
import { Card } from '../../ui/primitives/Card';
import { ListItem } from '../../ui/primitives/ListItem';

export const SettingsScreen: React.FC = () => {
  const { profiles, activeProfile, setActiveProfile } = useStore();
  return (
    <>
      <AppBar title="Settings" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 120px' }}>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', marginBottom: 6 }}>Profiles</div>
          {profiles.map(p => (
            <ListItem key={p.id} title={p.name} subtitle={`${p.height} cm · ${p.gender}`}
              trailing={activeProfile?.id === p.id ? <Check size={18} /> : undefined}
              onClick={() => p.id && setActiveProfile(p.id)} />
          ))}
        </Card>
        <Card>
          <p style={{ fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>Full settings — Health Connect, theme, data management — arrive in Slice 4.</p>
        </Card>
      </div>
    </>
  );
};
