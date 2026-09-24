import React, { useState } from 'react';
import { useT } from '../../i18n';
import { BORG_MAX, BORG_MIN, borgLabelKey } from '../derive/borg';
import { M3Slider } from '../kit/m3-slider';
import { AtlasSheet } from './AtlasSheet';

/** Mid-scale rather than 6: opening on "no effort at all" makes every drag a correction. */
const START = 13;

/**
 * "How hard was that?", as a sheet with one control: a Material 3 slider over
 * Borg's 6–20, the number large with its word beside it, and Skip / Save.
 *
 * It is a decision with an answer, so it gets the surface a decision gets — one
 * question, nothing else to look at — and it goes away once answered. `Skip`
 * is always offered; see `onSkip`, which the caller uses to end the exercise
 * anyway.
 */
export const AtlasRpeSheet: React.FC<{
  open: boolean;
  /** Named in the subtitle: the sheet can be raised for an exercise you left behind. */
  exerciseName: string;
  value?: number;
  /** Save. Closes the sheet. */
  onPick: (rpe: number) => void;
  /** Dismissal of any kind — the back button, the scrim, a drag, or `Skip` itself. */
  onSkip: () => void;
}> = ({ open, exerciseName, value, onPick, onSkip }) => {
  const { t } = useT();
  const [draft, setDraft] = useState(value ?? START);

  // Each raising of the sheet is its own question: the value it was left on
  // does not carry over from the exercise before.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setDraft(value ?? START);
  }

  return (
    <AtlasSheet
      open={open}
      onClose={onSkip}
      title={t('train.rpeAsk')}
      subtitle={exerciseName}
      footer={
        <>
          <button className="at-btn" data-ghost="true" onClick={onSkip}>
            {t('train.rpeSkip')}
          </button>
          <button className="at-btn" onClick={() => onPick(draft)}>
            {t('train.rpeConfirm', { n: draft })}
          </button>
        </>
      }
    >
      <p className="at-rpe-why">{t('train.rpeWhy')}</p>
      <div className="at-rpe-readout" aria-hidden="true">
        <b>{draft}</b>
        <span>{t(borgLabelKey(draft))}</span>
      </div>
      <M3Slider
        label={t('train.rpe')}
        value={draft}
        onChange={setDraft}
        min={BORG_MIN}
        max={BORG_MAX}
        valueText={n => `${n}, ${t(borgLabelKey(n))}`}
        marks={[
          { value: BORG_MIN, label: `${BORG_MIN} · ${t(borgLabelKey(BORG_MIN))}` },
          { value: 13, label: `13 · ${t(borgLabelKey(13))}` },
          { value: BORG_MAX, label: `${BORG_MAX} · ${t(borgLabelKey(BORG_MAX))}` },
        ]}
      />
    </AtlasSheet>
  );
};
