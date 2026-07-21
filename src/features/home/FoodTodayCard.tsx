import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';
import type { FoodLog } from '../../../core/entities/FoodLog';

export interface FoodTodayCardProps { logs: FoodLog[]; onDelete: (id: string) => void; onAdd: () => void; }

export const FoodTodayCard: React.FC<FoodTodayCardProps> = ({ logs, onDelete, onAdd }) => {
  const totalKcal = logs.reduce((s, l) => s + l.calories, 0);
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
          Food today · <span>{totalKcal}</span> kcal
        </div>
        <Button variant="tonal" onClick={onAdd}>Add food</Button>
      </div>
      {logs.length === 0 ? (
        <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>Nothing logged yet today.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {logs.map(log => (
            <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--ui-outline)' }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--ui-tonal)', color: 'var(--ui-on-tonal)', padding: '3px 8px', borderRadius: 999, flexShrink: 0 }}>{log.mealType}</span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14 }}>{log.description}
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ui-text-secondary)' }}>{log.calories} kcal · P{log.protein} C{log.carbs} F{log.fat}</span>
              </span>
              <button type="button" aria-label={`Delete ${log.description}`} onClick={() => log.id && onDelete(log.id)} style={{ background: 'none', border: 'none', color: 'var(--ui-error)', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
