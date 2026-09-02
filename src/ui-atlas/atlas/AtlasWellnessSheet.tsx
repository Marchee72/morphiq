import React, { useState } from 'react';
import { Moon, HeartPulse } from 'lucide-react';
import { useT } from '../../i18n';
import type { WellnessLog } from '../../core/entities/WellnessLog';
import { WELLNESS_ITEMS, type WellnessItemKey } from '../derive/wellness';
import { AtlasSegment, AtlasInput, AtlasTextarea } from './AtlasField';
import { AtlasSheet } from './AtlasSheet';

/** The four scales share one shape: 1 is the worst end, 5 the best. */
const SCALE = ['1', '2', '3', '4', '5'] as const;
type ScaleValue = (typeof SCALE)[number];

type Answers = Partial<Record<WellnessItemKey, number>>;

/**
 * How the day is going.
 *
 * Four questions the phone cannot answer for you — Health Connect has no record
 * type for stress, mood or soreness, and Samsung's own scores never leave
 * Samsung — above two readings it can: last night's sleep and your resting heart
 * rate. The read half is shown, not asked, and stays editable for the days the
 * watch missed and for anyone on the web build, where none of it exists.
 *
 * Every scale runs low-to-high in the same direction, including soreness and
 * stress: 1 is "wrecked" and "frayed", 5 is "fresh" and "calm". A mixed
 * direction here is where an inverted readiness score would hide, because the
 * number would still look plausible.
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
  const [sleepHours, setSleepHours] = useState('');
  const [notes, setNotes] = useState('');

  /**
   * Re-seed from the stored day each time it opens, during render rather than
   * in an effect — an effect renders one frame carrying the abandoned draft.
   * Same pattern as `AtlasDayNoteSheet` and `AtlasFinishSheet`.
   */
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setAnswers(Object.fromEntries(
        WELLNESS_ITEMS.map(item => [item.key, log?.[item.key]]).filter(([, v]) => v != null),
      ));
      // Blank rather than a rounded-off zero when the watch had nothing.
      setSleepHours(log?.sleepMinutes ? (log.sleepMinutes / 60).toFixed(1) : '');
      setNotes(log?.notes ?? '');
    }
  }

  const fromWatch = log?.sleepSource === 'health-connect';

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

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('wellness.title')}
      subtitle={t('wellness.subtitle')}
      footer={
        <button className="at-btn" onClick={save}>{t('common.save')}</button>
      }
    >
      {WELLNESS_ITEMS.map(item => (
        <div key={item.key}>
          <AtlasSegment<ScaleValue>
            label={t(item.labelKey)}
            options={SCALE.map(value => ({ value, label: value }))}
            value={answers[item.key] ? (String(answers[item.key]) as ScaleValue) : undefined}
            onChange={value => setAnswers(prev => ({ ...prev, [item.key]: Number(value) }))}
          />
          {/* The numbers mean nothing without their ends spelled out — a 2 for
              soreness has to be unambiguously the sore one. */}
          <div className="at-scale-ends">
            <span>{t(item.lowKey)}</span>
            <span>{t(item.highKey)}</span>
          </div>
        </div>
      ))}

      {fromWatch ? (
        <div className="at-wellness-read">
          <div>
            <small><Moon size={12} /> {t('wellness.sleep')}</small>
            <b>{log?.sleepMinutes ? fmt.duration(log.sleepMinutes * 60) : '—'}</b>
            {log?.sleepDeepMinutes != null && log.sleepDeepMinutes > 0 && (
              <span>{t('wellness.deep')} {fmt.duration(log.sleepDeepMinutes * 60)}</span>
            )}
          </div>
          <div>
            <small><HeartPulse size={12} /> {t('wellness.restingHr')}</small>
            <b>{log?.restingHr ? `${fmt.n(log.restingHr)} ${t('unit.bpm')}` : '—'}</b>
            {log?.hrvMs != null && log.hrvMs > 0 && (
              <span>{t('wellness.hrv')} {fmt.n(log.hrvMs)} ms</span>
            )}
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

      <AtlasTextarea
        label={t('wellness.notes')}
        value={notes}
        onChange={setNotes}
      />
    </AtlasSheet>
  );
};
