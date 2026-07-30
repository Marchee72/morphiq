import React from 'react';
import { LogOut } from 'lucide-react';
import { useT } from '../../i18n';
import { useSocial } from '../data/useSocial';
import { useElapsedSeconds } from '../components/useTicker';
import type { PresenceRowVM } from '../derive/social';

/**
 * Who else is in the gym with you, while you are training.
 *
 * Inline under the header rather than behind a control, because this is the one
 * piece of the feature you want *during* a set — an overlay would cover the
 * wheels at the exact moment you reach for it. It costs two lines and renders
 * nothing at all when you are training alone.
 *
 * Each row is the partner's exercise and where they are in it. Never a weight,
 * never a rep: they are doing their own workout at their own loads, and the
 * point of a shared session is the hour, not the numbers.
 */
export const AtlasSharedStrip: React.FC = () => {
  const { t } = useT();
  const { shared, sharedPartners, leaveShared } = useSocial();

  if (!shared) return null;

  return (
    <div className="at-shared">
      <div className="at-shared-head">
        <span className="at-shared-label">{t('buddy.togetherHeading')}</span>
        <button className="at-shared-leave" onClick={() => void leaveShared()}>
          <LogOut size={13} />
          {t('buddy.togetherLeave')}
        </button>
      </div>

      {sharedPartners.length === 0 ? (
        // The container opens before anybody accepts, and the minutes between
        // are exactly when you would wonder whether it worked. It also covers a
        // partner who has joined but not started: presence is what puts a row
        // here, and joining a room is not training in it.
        <p className="at-shared-waiting">{t('buddy.togetherWaiting')}</p>
      ) : (
        sharedPartners.map(row => <SharedRow key={row.profileId} row={row} />)
      )}
    </div>
  );
};

const SharedRow: React.FC<{ row: PresenceRowVM }> = ({ row }) => {
  const { t, fmt } = useT();
  // The ticking value stays at the render edge, as everywhere else — nothing
  // that counts belongs in a view model.
  const elapsed = useElapsedSeconds(row.startedAt);

  const progress = row.exerciseName && row.setNumber && row.setCount
    ? t('buddy.progress', {
        exercise: row.exerciseName,
        n: String(row.setNumber),
        total: String(row.setCount),
      })
    : t('buddy.warmingUp');

  return (
    <div className="at-shared-row">
      <span className="at-buddy-dot" aria-hidden="true" />
      <b>{row.name || '—'}</b>
      <small>{progress}</small>
      <span className="at-shared-time">{fmt.duration(elapsed)}</span>
    </div>
  );
};
