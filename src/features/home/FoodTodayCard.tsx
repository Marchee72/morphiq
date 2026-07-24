import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';
import type { FoodLog } from '../../core/entities/FoodLog';

export interface FoodTodayCardProps { logs: FoodLog[]; onDelete: (id: string) => void; onAdd: () => void; }

export const FoodTodayCard: React.FC<FoodTodayCardProps> = ({ logs, onDelete, onAdd }) => {
  const totalKcal = logs.reduce((s, l) => s + l.calories, 0);
  const totalP = logs.reduce((s, l) => s + l.protein, 0);
  const totalC = logs.reduce((s, l) => s + l.carbs, 0);
  const totalF = logs.reduce((s, l) => s + l.fat, 0);

  const pKcal = totalP * 4;
  const cKcal = totalC * 4;
  const fKcal = totalF * 9;
  const macroKcalTotal = pKcal + cKcal + fKcal;

  const pPct = macroKcalTotal > 0 ? Math.round((pKcal / macroKcalTotal) * 100) : 0;
  const cPct = macroKcalTotal > 0 ? Math.round((cKcal / macroKcalTotal) * 100) : 0;
  const fPct = macroKcalTotal > 0 ? Math.round((fKcal / macroKcalTotal) * 100) : 0;

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Food today · <span>{totalKcal.toFixed(2)}</span> kcal
        </div>
        <Button variant="tonal" onClick={onAdd}>Add food</Button>
      </div>

      {logs.length === 0 ? (
        <p style={{ marginTop: 12, fontSize: 13.5, color: 'var(--ui-text-secondary)' }}>Nothing logged yet today.</p>
      ) : (
        <>
          {/* Macro Breakdown Bar */}
          <div style={{ marginTop: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--ui-outline)' }}>
              {pPct > 0 && <div style={{ width: `${pPct}%`, background: 'var(--ui-primary)' }} title={`Protein: ${totalP.toFixed(2)}g (${pPct}%)`} />}
              {cPct > 0 && <div style={{ width: `${cPct}%`, background: '#1A7F4B' }} title={`Carbs: ${totalC.toFixed(2)}g (${cPct}%)`} />}
              {fPct > 0 && <div style={{ width: `${fPct}%`, background: '#7C4DFF' }} title={`Fat: ${totalF.toFixed(2)}g (${fPct}%)`} />}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--ui-text-secondary)', marginTop: 6, flexWrap: 'wrap', gap: 4 }}>
              <span style={{ color: 'var(--ui-primary)' }}>Protein {totalP.toFixed(2)}g ({pPct}%)</span>
              <span style={{ color: '#1A7F4B' }}>Carbs {totalC.toFixed(2)}g ({cPct}%)</span>
              <span style={{ color: '#7C4DFF' }}>Fat {totalF.toFixed(2)}g ({fPct}%)</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {logs.map(log => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--ui-outline)', minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--ui-tonal)', color: 'var(--ui-on-tonal)', padding: '3px 8px', borderRadius: 999, flexShrink: 0 }}>{log.mealType}</span>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.description}
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ui-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.calories.toFixed(2)} kcal · P{log.protein.toFixed(2)} C{log.carbs.toFixed(2)} F{log.fat.toFixed(2)}</span>
                </span>
                <button type="button" aria-label={`Delete ${log.description}`} onClick={() => log.id && onDelete(log.id)} style={{ background: 'none', border: 'none', color: 'var(--ui-error)', cursor: 'pointer', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>Delete</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};

