import React, { useState } from 'react';
import { useT } from '../../i18n';
import { BORG_MAX, BORG_MIN, BORG_QUICK, BORG_VALUES, borgLabelKey } from '../derive/borg';
import { AtlasDial } from './AtlasDial';
import { AtlasSheet } from './AtlasSheet';

/**
 * "How hard was that?", as a sheet rather than a card in the scroll.
 *
 * The question used to render inline, in two different places on the train
 * screen, which made it a thing you scrolled past: five small chips wedged
 * between the set list and the action bar, competing with the primary button for
 * the same glance. It is a decision with an answer, so it gets the surface a
 * decision gets — one question on screen, nothing else to look at, and it goes
 * away when it has been answered.
 *
 * Answering is still one tap. The five rungs commit on press rather than arming
 * a Save, because an exertion scale that costs two taps mid-workout is an
 * exertion scale nobody fills in. `Skip` is the only way past it that is not an
 * answer, and it is always offered — see `onSkip`, which the caller uses to end
 * the exercise anyway.
 */

/** Where a rung sits on the 6-20 scale, as 1-5 — drives the tint and the meter. */
const level = (index: number) => index + 1;

export const AtlasRpeSheet: React.FC<{
  open: boolean;
  /** Named in the subtitle: the sheet can be raised for an exercise you left behind. */
  exerciseName: string;
  value?: number;
  /** One tap on a rung, or the dial's confirm. Closes the sheet. */
  onPick: (rpe: number) => void;
  /** Dismissal of any kind — the back button, the scrim, or `Skip` itself. */
  onSkip: () => void;
}> = ({ open, exerciseName, value, onPick, onSkip }) => {
  const { t } = useT();

  /** The 15-rung dial, for when five is not the resolution you want. */
  const [fine, setFine] = useState(false);
  /**
   * The dial holds a value to open on. Mid-scale rather than 6: opening on "no
   * exertion at all" makes every flick a correction.
   */
  const [draft, setDraft] = useState(value ?? 13);

  // Each raising of the sheet is its own question, so neither the dial nor the
  // value it was left on carries over from the exercise before.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setFine(false);
    setDraft(value ?? 13);
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
          {fine && (
            <button className="at-btn" onClick={() => onPick(draft)}>
              {t('train.rpeConfirm', { n: draft })}
            </button>
          )}
        </>
      }
    >
      <p className="at-rpe-why">{t('train.rpeWhy')}</p>

      {fine ? (
        <div className="at-rpe-dial">
          <AtlasDial
            label={t('train.rpe')}
            value={draft}
            onChange={setDraft}
            min={BORG_MIN}
            max={BORG_MAX}
            step={1}
            values={[...BORG_VALUES]}
          />
          <p className="at-borg-caption">{t(borgLabelKey(draft))}</p>
        </div>
      ) : (
        <>
          <div className="at-rpe-rungs">
            {BORG_QUICK.map((rpe, i) => (
              <button
                key={rpe}
                type="button"
                className="at-rpe-rung"
                data-level={level(i)}
                data-on={value === rpe}
                aria-pressed={value === rpe}
                onClick={() => onPick(rpe)}
              >
                <b>{rpe}</b>
                <span>
                  <em>{t(borgLabelKey(rpe))}</em>
                  {/* Five bars filling left to right: the ladder is easier to
                      read as a shape than as five numbers between 11 and 19. */}
                  <i className="at-rpe-meter" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map(step => (
                      <u key={step} data-fill={step <= level(i)} />
                    ))}
                  </i>
                </span>
              </button>
            ))}
          </div>

          <button type="button" className="at-rpe-fine" onClick={() => setFine(true)}>
            {t('train.rpeMore')}
          </button>
        </>
      )}
    </AtlasSheet>
  );
};
