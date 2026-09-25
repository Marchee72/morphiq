import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Moon } from 'lucide-react';
import { useT } from '../../i18n';
import type { WellnessLog } from '../../core/entities/WellnessLog';
import { WELLNESS_SCALE_MAX, WELLNESS_SCALE_MIN } from '../../core/entities/WellnessLog';
import { WELLNESS_ITEMS, isAnswered, type WellnessItemKey } from '../derive/wellness';
import { AtlasInput, AtlasTextarea } from './AtlasField';
import { AtlasSheet } from './AtlasSheet';

type Answers = Partial<Record<WellnessItemKey, number>>;

/** The summary sits after the four questions. */
const SUMMARY = WELLNESS_ITEMS.length;
/** Long enough to see the choice land before the next question slides in. */
const ADVANCE_MS = 280;
const SCALE = Array.from({ length: WELLNESS_SCALE_MAX - WELLNESS_SCALE_MIN + 1 }, (_, i) => WELLNESS_SCALE_MIN + i);

/**
 * How the day is going, one question at a time.
 *
 * Four questions the phone cannot answer for you — no record type anywhere
 * holds stress, mood or soreness. Each is five buttons, a number and a word, and
 * a tap moves on to the next; the summary at the end is where each can be
 * changed, and where sleep is typed on the days no watch read it.
 *
 * The questions slide inside a window that clips them, so nothing can push the
 * page sideways — which the slider this replaced did at its top value.
 *
 * Every scale runs low-to-high in the same direction, including soreness and
 * stress: 1 is "wrecked" and "frayed", 5 is "fresh" and "calm".
 */
export const AtlasWellnessSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  /** Today's row, or null when the day has not been touched. */
  log: WellnessLog | null;
  onSave: (patch: Partial<WellnessLog>) => void;
}> = ({ open, onClose, log, onSave }) => {
  const { t, fmt } = useT();

  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  /** Set when a question was opened from the summary: answering it goes back there. */
  const [editing, setEditing] = useState(false);
  const [sleepHours, setSleepHours] = useState('');
  const [notes, setNotes] = useState('');
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (advance.current) clearTimeout(advance.current); }, []);

  /**
   * Re-seed from the stored day each time it opens, during render rather than
   * in an effect — an effect renders one frame carrying the abandoned draft.
   * An answered day opens on its summary: the questions are done, it is a look
   * or a correction.
   */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setAnswers(Object.fromEntries(
        WELLNESS_ITEMS.map(item => [item.key, log?.[item.key]]).filter(([, v]) => v != null),
      ));
      setStep(isAnswered(log) ? SUMMARY : 0);
      setEditing(false);
      // Blank rather than a rounded-off zero when the watch had nothing.
      setSleepHours(log?.sleepMinutes ? (log.sleepMinutes / 60).toFixed(1) : '');
      setNotes(log?.notes ?? '');
    }
  }

  const fromWatch = log?.sleepSource === 'health-connect';

  const pick = (key: WellnessItemKey, index: number, value: number) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
    if (advance.current) clearTimeout(advance.current);
    advance.current = setTimeout(() => {
      setStep(editing ? SUMMARY : index + 1);
      setEditing(false);
    }, ADVANCE_MS);
  };

  const save = () => {
    const hours = Number(sleepHours.replace(',', '.'));
    onSave({
      ...answers,
      // Only send sleep when it was typed here. Passing the imported value back
      // would relabel a watch reading as manual on every save.
      ...(!fromWatch && Number.isFinite(hours) && hours > 0
        ? { sleepMinutes: Math.round(hours * 60), sleepSource: 'manual' as const }
        : {}),
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const word = (key: WellnessItemKey, n: number) =>
    t(WELLNESS_ITEMS.find(item => item.key === key)!.levelKeys[n - WELLNESS_SCALE_MIN]);

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={step < SUMMARY ? t(WELLNESS_ITEMS[step].questionKey) : t('wellness.done')}
      subtitle={step < SUMMARY ? t('wellness.step', { n: step + 1, total: SUMMARY }) : t('wellness.title')}
      footer={step === SUMMARY ? <button className="at-btn" onClick={save}>{t('common.save')}</button> : undefined}
    >
      <div className="at-steps-head">
        <button
          className="at-round"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          aria-label={t('wellness.prev')}
        >
          <ChevronLeft size={18} />
        </button>
        <span aria-hidden="true">
          {WELLNESS_ITEMS.map((item, i) => (
            <i key={item.key} data-on={i < step || answers[item.key] != null} />
          ))}
        </span>
      </div>

      <div className="at-steps-window">
        <motion.div
          className="at-steps-track"
          animate={{ x: `${-step * 100}%` }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        >
          {WELLNESS_ITEMS.map((item, index) => (
            <section key={item.key} className="at-step" inert={index !== step}>
              <div role="radiogroup" aria-label={t(item.labelKey)} className="at-step-options">
                {SCALE.map(n => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={answers[item.key] === n}
                    data-on={answers[item.key] === n}
                    onClick={() => pick(item.key, index, n)}
                  >
                    <b>{n}</b>
                    <span>{word(item.key, n)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <section className="at-step" inert={step !== SUMMARY}>
            <div className="at-card at-step-summary">
              {WELLNESS_ITEMS.map((item, index) => {
                const value = answers[item.key];
                return (
                  <button key={item.key} onClick={() => { setEditing(true); setStep(index); }}>
                    <span>{t(item.labelKey)}</span>
                    <b>{value != null ? `${value} · ${word(item.key, value)}` : '—'}</b>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            {fromWatch ? (
              <div className="at-wellness-read">
                <div>
                  <small><Moon size={12} /> {t('wellness.sleep')}</small>
                  <b>{log?.sleepMinutes ? fmt.duration(log.sleepMinutes * 60) : '—'}</b>
                </div>
              </div>
            ) : (
              <AtlasInput
                label={t('wellness.sleep')}
                hint={t('wellness.sleepHint')}
                value={sleepHours}
                inputMode="decimal"
                suffix={t('unit.hours')}
                onChange={setSleepHours}
              />
            )}
            {fromWatch && <p className="at-metric-source">{t('wellness.fromHealthConnect')}</p>}

            <AtlasTextarea label={t('wellness.notes')} value={notes} onChange={setNotes} />
          </section>
        </motion.div>
      </div>
    </AtlasSheet>
  );
};
