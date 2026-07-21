import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';

export interface SyncCardProps { state: 'idle' | 'syncing' | 'success' | 'error'; message?: string; onSync: () => void; }

export const SyncCard: React.FC<SyncCardProps> = ({ state, message, onSync }) => (
  <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>Samsung Health</div>
      <Button variant="tonal" onClick={onSync} disabled={state === 'syncing'}>{state === 'syncing' ? 'Syncing…' : 'Sync now'}</Button>
    </div>
    {message && <p style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: state === 'error' ? 'var(--ui-error)' : 'var(--ui-success)' }}>{message}</p>}
  </Card>
);
