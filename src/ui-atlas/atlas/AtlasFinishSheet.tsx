import React, { useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { useT } from '../../i18n';
import { FEELING_OPTIONS } from '../../features/gym/feelingOptions';
import type { FeelingId, SessionTotalsVM } from '../types';
import { AtlasSheet } from './AtlasSheet';

/**
 * The step between "finish" and a written workout log.
 *
 * Finishing used to be one tap on a ghost button with no confirmation, which for
 * an action that ends a session and discards every unlogged set is far too
 * cheap. This states what is about to be saved, says plainly what will not be,
 * and asks.
 *
 * It also collects how the session felt. That question used to sit next to the
 * finish button mid-session, which is the one moment you cannot answer it — you
 * know how a workout went when it is over.
 */
export const AtlasFinishSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  totals: SessionTotalsVM;
  /** Frozen by the caller when the sheet opens — a ticking clock behind a modal is noise. */
  elapsedSec: number;
  initialFeeling?: FeelingId;
  /** A write is already in flight, so confirming again would file the session twice. */
  busy?: boolean;
  onConfirm: (feeling: FeelingId | undefined) => void;
}> = ({ open, onClose, totals, elapsedSec, initialFeeling, busy = false, onConfirm }) => {
  const { t, tp, fmt } = useT();
  const [feeling, setFeeling] = useState<FeelingId | undefined>(initialFeeling);

  // Re-seed on each open rather than in an effect, which would render one frame
  // with the abandoned draft — the same pattern `AtlasDayNoteSheet` uses.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setFeeling(initialFeeling);
  }

  const unlogged = Math.max(0, totals.setsPlanned - totals.setsDone);

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('train.finishConfirmTitle')}
      subtitle={t('train.finishConfirmSub', {
        sets: tp('unit.sets', totals.setsDone),
        volume: fmt.n(totals.volumeKg),
        time: fmt.duration(elapsedSec),
      })}
      footer={
        <>
          <button className="at-btn" data-ghost="true" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="at-btn" disabled={busy} onClick={() => onConfirm(feeling)}>
            <Check size={15} strokeWidth={3} /> {busy ? t('train.finishing') : t('train.finishNow')}
          </button>
        </>
      }
    >
      {unlogged > 0 && (
        <div className="at-warn">
          <AlertTriangle size={15} />
          <span>{tp('train.finishConfirmUnlogged', unlogged)}</span>
        </div>
      )}

      <div className="at-field">
        <div className="at-field-label">{t('train.howDoYouFeel')}</div>
        <div className="at-choice">
          {FEELING_OPTIONS.map(option => {
            const selected = feeling === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className="at-feeling"
                data-on={selected}
                onClick={() => setFeeling(selected ? undefined : option.id)}
                style={selected ? { background: option.bg, borderColor: option.color, color: option.color } : undefined}
                aria-pressed={selected}
              >
                <span aria-hidden="true">{option.emoji}</span> {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </AtlasSheet>
  );
};
