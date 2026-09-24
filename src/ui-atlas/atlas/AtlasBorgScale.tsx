import React, { useState } from 'react';
import { useT } from '../../i18n';
import { BORG_MAX, BORG_MIN, BORG_QUICK, borgLabelKey } from '../derive/borg';
import { M3Slider } from '../kit/m3-slider';

/**
 * How hard that was, on Borg's 6-20 scale.
 *
 * Two shapes for one question, because the question is asked in two very
 * different moments. `quick` is the one that appears mid-workout: five buttons,
 * one tap, no sheet to dismiss — anything heavier and it gets skipped every
 * time, which is the failure mode that makes an exertion scale worthless.
 * `full` is for when five rungs are not enough and you want the number between
 * two of them.
 *
 * The full variant is the same Material 3 slider the effort sheet uses, so the
 * scale looks and moves the same wherever it is asked.
 */
export const AtlasBorgScale: React.FC<{
  value?: number;
  onChange: (rpe: number) => void;
  /** Renders the "…" that swaps `quick` for `full`. Off inside a sheet. */
  expandable?: boolean;
}> = ({ value, onChange, expandable = true }) => {
  const { t } = useT();
  const [full, setFull] = useState(false);

  if (full) {
    return (
      <div className="at-borg-full">
        <M3Slider
          label={t('train.rpe')}
          // Must hold a value to open on. Mid-scale rather than 6: opening on
          // "no effort at all" makes every drag a correction.
          value={value ?? 13}
          onChange={onChange}
          min={BORG_MIN}
          max={BORG_MAX}
          valueText={n => `${n}, ${t(borgLabelKey(n))}`}
        />
        <p className="at-borg-caption">{t(borgLabelKey(value ?? 13))}</p>
      </div>
    );
  }

  return (
    <div className="at-borg">
      {BORG_QUICK.map(rpe => (
        <button
          key={rpe}
          type="button"
          className="at-chip at-borg-chip"
          data-on={value === rpe}
          aria-pressed={value === rpe}
          onClick={() => onChange(rpe)}
        >
          <b>{rpe}</b>
          <small>{t(borgLabelKey(rpe))}</small>
        </button>
      ))}
      {expandable && (
        <button
          type="button"
          className="at-chip at-borg-chip"
          data-more="true"
          onClick={() => setFull(true)}
          aria-label={t('train.rpeMore')}
        >
          <b>…</b>
        </button>
      )}
    </div>
  );
};
