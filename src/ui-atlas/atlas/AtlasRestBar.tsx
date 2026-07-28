import React from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useTicker } from '../components/useTicker';
import { remainingSec, useRestTimer } from '../state/restTimer';

/** The adjustment everyone reaches for: one more (or one less) short breather. */
const NUDGE_SEC = 30;

/**
 * The rest countdown, as a thing you can act on.
 *
 * Rest used to be a thin arc around the disc plus a "skip" button several
 * sections down the page — you could see that you were resting but not how long
 * was left without decoding the arc, and the only control was all-or-nothing.
 * `useRestTimer.extend` existed the whole time and nothing called it.
 *
 * Renders nothing when no clock is running, and owns its own ticker so the
 * per-second re-render stops here instead of reaching the dials.
 *
 * Getting rid of it is deliberately easy: the whole bar dismisses on tap, with
 * an explicit ✕ for anyone who wants a target to aim at. Rest is a suggestion,
 * and a suggestion you cannot wave away is an obstruction.
 */
export const AtlasRestBar: React.FC = () => {
  const { t, fmt } = useT();
  const { endsAt, extend, stop } = useRestTimer();
  const tick = useTicker(1000, endsAt !== null);
  const left = remainingSec(endsAt, tick);

  if (endsAt === null || left <= 0) return null;

  return (
    // Tapping the bar anywhere dismisses it; the controls inside stop the event
    // so adjusting the clock does not also throw it away.
    <div
      className="at-restbar"
      role="timer"
      aria-live="off"
      onClick={stop}
      title={t('train.dismissRest')}
    >
      <button
        onClick={e => { e.stopPropagation(); extend(-NUDGE_SEC); }}
        aria-label={t('train.restSubtract')}
      >
        <Minus size={15} />
      </button>

      <div className="at-restbar-clock">
        <small>{t('train.restLeft')}</small>
        <b>{fmt.duration(left)}</b>
      </div>

      <button
        onClick={e => { e.stopPropagation(); extend(NUDGE_SEC); }}
        aria-label={t('train.restAdd')}
      >
        <Plus size={15} />
      </button>

      <button className="at-restbar-skip" onClick={stop} aria-label={t('train.dismissRest')}>
        <X size={15} />
      </button>
    </div>
  );
};
