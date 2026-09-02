import React from 'react';
import { Play, Check, Trash2 } from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { cancelActiveWorkoutNotification } from '../../data/health/ActiveWorkoutNotification';
import { AtlasSheet } from './AtlasSheet';

/**
 * The question asked when a workout outlived the app that was running it.
 *
 * Three answers rather than one, because the right one depends on something the
 * app cannot know: whether you are still in the gym. Resuming a session you
 * finished two hours ago would file a three-hour workout; discarding one you
 * are still in the middle of would lose the sets. So it asks.
 *
 * The elapsed figure is deliberately static — `savedAt` minus `startTime`, not
 * a live ticker. The session is not running, and a counting clock would say it
 * was.
 */
export const AtlasResumeSheet: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { t, fmt } = useT();
  const pending = useStore(s => s.pendingResume);

  if (!pending) return null;

  const { session, savedAt } = pending;
  const ranForSeconds = Math.max(
    0,
    Math.floor((savedAt.getTime() - new Date(session.startTime).getTime()) / 1000),
  );

  const resume = () => {
    useStore.getState().resumePendingSession();
    onClose();
  };

  const finish = async () => {
    onClose();
    await useStore.getState().finishPendingSession();
    // The foreground service may still be up from before the app died; the
    // session it was counting is now filed.
    await cancelActiveWorkoutNotification().catch(() => { /* best-effort */ });
  };

  const discard = async () => {
    useStore.getState().discardPendingSession();
    onClose();
    await cancelActiveWorkoutNotification().catch(() => { /* best-effort */ });
  };

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('resume.title')}
      subtitle={t('resume.subtitle')}
    >
      <div className="at-card" style={{ padding: 20 }}>
        <h4 className="at-serif" style={{ margin: 0 }}>{session.workoutType}</h4>
        <div className="at-routine-meta">
          {t('resume.meta', {
            sets: session.sets.length,
            duration: fmt.duration(ranForSeconds),
          })}
        </div>
        <small className="at-field-hint">
          {t('resume.stopped', { when: fmt.relativeDay(savedAt) })}
        </small>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            className="at-btn"
            style={{ flex: 1, justifyContent: 'center', padding: 12 }}
            onClick={resume}
          >
            <Play size={15} /> {t('resume.resume')}
          </button>
          <button className="at-btn" data-ghost="true" onClick={() => void finish()}>
            <Check size={15} /> {t('resume.finish')}
          </button>
        </div>

        {/* Third, and visually last: it is the only one that loses data. */}
        <button
          className="at-btn"
          data-ghost="true"
          style={{ justifyContent: 'center', width: '100%', marginTop: 10 }}
          onClick={() => void discard()}
        >
          <Trash2 size={14} /> {t('resume.discard')}
        </button>
      </div>
    </AtlasSheet>
  );
};
