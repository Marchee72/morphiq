import React, { useState } from 'react';
import { AlertTriangle, BatteryLow, Bandage, Check, Flame, Zap } from 'lucide-react';
import { useT } from '../../i18n';
import { FEELING_OPTIONS } from '../../features/gym/feelingOptions';
import { BORG_MAX, BORG_MIN, borgLabelKey, trainingLoad } from '../derive/borg';
import type { StaticKey } from '../../i18n/types';
import type { FeelingId, SessionExerciseVM, SessionTotalsVM } from '../types';
import { M3Slider } from '../kit/m3-slider';
import { AtlasSheet } from './AtlasSheet';

/** Mid-scale, as the effort sheet opens: starting on "no effort" makes every drag a correction. */
const RPE_START = 13;

/**
 * Icon and short name for each feeling, so the five fit one row. The full label
 * stays the button's accessible name.
 */
const FEELING_FACE: Record<FeelingId, { icon: React.ReactNode; shortKey: StaticKey }> = {
  feeling_100: { icon: <Flame size={20} />, shortKey: 'feeling.short.feeling_100' },
  good: { icon: <Zap size={20} />, shortKey: 'feeling.short.good' },
  sore: { icon: <AlertTriangle size={20} />, shortKey: 'feeling.short.sore' },
  pain: { icon: <Bandage size={20} />, shortKey: 'feeling.short.pain' },
  low_energy: { icon: <BatteryLow size={20} />, shortKey: 'feeling.short.low_energy' },
};

/**
 * The step between "finish" and a written workout log.
 *
 * Finishing used to be one tap on a ghost button with no confirmation, which for
 * an action that ends a session and discards every unlogged set is far too
 * cheap. This states what is about to be saved, says plainly what will not be,
 * and asks.
 *
 * It also collects how the session felt, and how hard the exercises no one rated
 * were — almost always the one you were on when you decided to stop. Effort is a
 * slider, the effort sheet's own, and is only written when you finish: rating on
 * every drag made the row vanish from under the finger the moment it counted as
 * rated. "Skip" leaves them unrated.
 */
export const AtlasFinishSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  totals: SessionTotalsVM;
  /** Frozen by the caller when the sheet opens — a ticking clock behind a modal is noise. */
  elapsedSec: number;
  /** Shown over the question, so it is clear which session ends. */
  sessionTitle?: string;
  initialFeeling?: FeelingId;
  /** A write is already in flight, so confirming again would file the session twice. */
  busy?: boolean;
  onConfirm: (feeling: FeelingId | undefined) => void;
  /** The session's exercises, to find the ones that were never rated. */
  exercises?: SessionExerciseVM[];
  onRate?: (exerciseName: string, rpe: number) => void;
}> = ({
  open, onClose, totals, elapsedSec, sessionTitle, initialFeeling, busy = false, onConfirm,
  exercises = [], onRate,
}) => {
  const { t, tp, fmt } = useT();
  const [feeling, setFeeling] = useState<FeelingId | undefined>(initialFeeling);
  const [efforts, setEfforts] = useState<Record<string, number>>({});
  const [skipped, setSkipped] = useState(false);

  // Re-seed on each open rather than in an effect, which would render one frame
  // with the abandoned draft — the same pattern `AtlasDayNoteSheet` uses.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setFeeling(initialFeeling);
      setEfforts({});
      setSkipped(false);
    }
  }

  const unlogged = Math.max(0, totals.setsPlanned - totals.setsDone);
  const load = trainingLoad(totals.avgRpe, Math.round(elapsedSec / 60));

  /** Exercises with work behind them and no rating. */
  const unrated = onRate
    ? exercises.filter(ex => ex.rpe === undefined && ex.sets.some(s => s.done))
    : [];
  const asking = unrated.length > 0 && !skipped;
  const effortOf = (name: string) => efforts[name] ?? RPE_START;

  const finish = () => {
    if (asking) for (const ex of unrated) onRate?.(ex.name, effortOf(ex.name));
    onConfirm(feeling);
  };

  const volume = totals.volumeKg >= 1000
    ? `${fmt.n(totals.volumeKg / 1000, 1)} ${t('unit.tonnes')}`
    : `${fmt.n(totals.volumeKg)} ${t('unit.kg')}`;

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('train.finishConfirmTitle')}
      subtitle={sessionTitle}
      footer={
        <div className="at-finish-foot">
          <button className="at-btn" disabled={busy} onClick={finish}>
            <Check size={16} strokeWidth={3} /> {busy ? t('train.finishing') : t('train.finishNow')}
          </button>
          <button className="at-finish-back" onClick={onClose}>{t('train.keepTraining')}</button>
        </div>
      }
    >
      {/* What is about to be saved, as numbers rather than a caption. */}
      <div className="at-finish-stats">
        <div><b>{fmt.duration(elapsedSec)}</b><small>{t('summary.duration')}</small></div>
        <div><b>{totals.setsDone}</b><small>{t('summary.sets')}</small></div>
        <div><b>{volume}</b><small>{t('summary.volume')}</small></div>
      </div>

      {unlogged > 0 && (
        <div className="at-warn">
          <AlertTriangle size={15} />
          <span>{tp('train.finishConfirmUnlogged', unlogged)}</span>
        </div>
      )}

      {/* Only when something was actually rated. An em-dash here would be
          answering a question nobody was asked. */}
      {totals.avgRpe !== null && (
        <div className="at-rpe-summary">
          <div>
            <small>{t('train.rpeAvg')}</small>
            <b>{fmt.upTo(totals.avgRpe, 1)}</b>
          </div>
          <div>
            <small>{t('train.rpeMax')}</small>
            <b>{totals.maxRpe}</b>
          </div>
          {load !== null && (
            <div>
              <small>{t('train.sessionLoad')}</small>
              <b>{fmt.n(load)}</b>
            </div>
          )}
        </div>
      )}

      {asking && (
        <div className="at-finish-effort">
          <div className="at-finish-effort-head">
            <h4>{t('train.howHard')}</h4>
            <button onClick={() => setSkipped(true)}>{t('train.skipRating')}</button>
          </div>
          {unrated.map(exercise => {
            const value = effortOf(exercise.name);
            return (
              <div key={exercise.key} className="at-finish-effort-row">
                <div className="at-finish-effort-name">
                  <span>{exercise.name}</span>
                  <span><b>{value}</b> · {t(borgLabelKey(value))}</span>
                </div>
                <M3Slider
                  label={t('train.rpePending', { name: exercise.name })}
                  value={value}
                  onChange={v => setEfforts(prev => ({ ...prev, [exercise.name]: v }))}
                  min={BORG_MIN}
                  max={BORG_MAX}
                  valueText={n => `${n}, ${t(borgLabelKey(n))}`}
                  marks={[
                    { value: BORG_MIN, label: `${BORG_MIN} · ${t(borgLabelKey(BORG_MIN))}` },
                    { value: RPE_START, label: `${RPE_START} · ${t(borgLabelKey(RPE_START))}` },
                    { value: BORG_MAX, label: `${BORG_MAX} · ${t(borgLabelKey(BORG_MAX))}` },
                  ]}
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="at-finish-feel">
        <h4>{t('train.howDoYouFeel')}</h4>
        <div className="at-finish-feelings">
          {FEELING_OPTIONS.map(option => {
            const selected = feeling === option.id;
            const face = FEELING_FACE[option.id];
            return (
              <button
                key={option.id}
                type="button"
                className="at-finish-feeling"
                data-on={selected}
                onClick={() => setFeeling(selected ? undefined : option.id)}
                aria-pressed={selected}
                aria-label={t(option.labelKey)}
              >
                {face.icon}
                <span>{t(face.shortKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </AtlasSheet>
  );
};
