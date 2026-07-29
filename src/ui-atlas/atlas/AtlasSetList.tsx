import React, { useEffect, useRef, useState } from 'react';
import { Check, Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import type { SessionSetVM } from '../types';

/**
 * Every set of the current exercise, at a glance and correctable.
 *
 * The wheels above address one set — the one under the cursor — which suits
 * logging as you go. It does not suit filling the whole exercise in afterwards,
 * or noticing on set 4 that set 2 went in wrong. Neither needed the cursor to
 * move; they needed the sets to be visible.
 *
 * Editing here writes straight to the set it belongs to rather than driving the
 * wheels, so correcting set 2 does not drag you back to set 2.
 *
 * Which row is open is the caller's state rather than this component's, because
 * this is now the only way to change a set that is already done — the set pills
 * above hand a finished set down to here instead of putting the wheels on it.
 */
export const AtlasSetList: React.FC<{
  sets: SessionSetVM[];
  currentIdx: number;
  /** The row whose inputs are open, or null. */
  editing: number | null;
  onEditing: (setIdx: number | null) => void;
  onUpdate: (setIdx: number, patch: { weightKg?: number; reps?: number; done?: boolean }) => void;
}> = ({ sets, currentIdx, editing, onEditing, onUpdate }) => {
  const { t, fmt } = useT();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  /**
   * Seed the inputs from the row being opened. During render rather than in an
   * effect, matching `useSetDraft` — an effect renders one frame carrying the
   * previous row's numbers.
   */
  const [seen, setSeen] = useState<number | null>(editing);
  if (seen !== editing) {
    setSeen(editing);
    const target = editing != null ? sets[editing] : undefined;
    setWeight(target && target.weightKg > 0 ? String(target.weightKg) : '');
    setReps(target && target.reps > 0 ? String(target.reps) : '');
  }

  /**
   * The request to edit can come from a set pill, which is most of a screen
   * above this list — opening a row you cannot see reads as the pill doing
   * nothing. Optional-called because jsdom has no layout to scroll.
   */
  const openRow = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (editing != null) openRow.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [editing]);

  if (sets.length === 0) return null;

  const commit = (i: number) => {
    onEditing(null);
    const w = Number(weight.replace(',', '.'));
    const r = Number(reps.replace(',', '.'));
    if (!Number.isFinite(w) || !Number.isFinite(r)) return;
    // Typing numbers into a set is the act of recording it, so it counts as done.
    onUpdate(i, { weightKg: Math.max(0, w), reps: Math.max(0, Math.round(r)), done: true });
  };

  return (
    <div className="at-setlist">
      {sets.map((set, i) => {
        const logged = set.done || set.weightKg > 0 || set.reps > 0;

        if (editing === i) {
          return (
            <div key={set.setNum} className="at-setrow" data-editing="true" ref={openRow}>
              <span className="at-setrow-n">{set.setNum}</span>
              <input
                className="at-setrow-input"
                type="text"
                inputMode="decimal"
                autoFocus
                value={weight}
                onChange={e => setWeight(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commit(i); if (e.key === 'Escape') onEditing(null); }}
                aria-label={`${t('train.weight')} ${set.setNum}`}
              />
              <span className="at-setrow-x">{t('unit.kg')} ×</span>
              <input
                className="at-setrow-input"
                type="text"
                inputMode="numeric"
                value={reps}
                onChange={e => setReps(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commit(i); if (e.key === 'Escape') onEditing(null); }}
                aria-label={`${t('train.reps')} ${set.setNum}`}
              />
              <button className="at-setrow-tick" data-on="true" onClick={() => commit(i)} aria-label={t('common.save')}>
                <Check size={14} strokeWidth={3} />
              </button>
            </div>
          );
        }

        return (
          <div key={set.setNum} className="at-setrow" data-done={set.done} data-cur={i === currentIdx}>
            <span className="at-setrow-n">{set.setNum}</span>

            <button
              className="at-setrow-val"
              onClick={() => onEditing(i)}
              aria-label={t('train.editSetValues', { n: set.setNum })}
            >
              {logged ? fmt.kgReps(set.weightKg, set.reps) : <i>—</i>}
              {set.isPr && <Trophy size={11} />}
            </button>

            {/* Ticking an empty row would record 0 kg × 0, so it asks for the
                numbers instead of inventing them. */}
            <button
              className="at-setrow-tick"
              data-on={set.done}
              onClick={() => (logged ? onUpdate(i, { done: !set.done }) : onEditing(i))}
              aria-label={t('train.markSetDone', { n: set.setNum })}
              aria-pressed={set.done}
            >
              <Check size={14} strokeWidth={3} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
