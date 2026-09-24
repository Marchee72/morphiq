import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { useAppActions } from '../data/useAppData';

/**
 * The way back to a workout the resume sheet was closed on.
 *
 * The sheet asks once per launch (`AppShell`'s `askedToResume`), and closing it
 * with the X answers none of its three questions: the stored session stays
 * alive with nothing on screen pointing at it, and on the native app only
 * killing the process offers it again. Making the sheet impossible to close
 * would fix that by turning a question into a trap, so instead the door stays
 * visible — while there is something to resume and nothing running, this band
 * is there, and tapping it asks again.
 *
 * Same slot and same frame as `AtlasSyncBanner`, above `app-scroll`: it is a
 * fact about the app rather than about the screen you happen to be on, and it
 * must not flicker when you switch tabs looking for it.
 */
export const AtlasResumeBanner: React.FC = () => {
  const { t } = useT();
  const actions = useAppActions();
  const pending = useStore(s => s.pendingResume);
  const activeSession = useStore(s => s.activeSession);
  const activeProfile = useStore(s => s.activeProfile);

  // The same three guards the shell asks its question behind. A live session
  // outranks a stored one — offering both would be offering to resume the
  // workout you are already doing — and a stored session belonging to someone
  // else on a shared device is not yours to be offered.
  if (!pending || activeSession) return null;
  if (pending.profileId !== activeProfile?.id) return null;

  return (
    <button
      className="at-top-banner at-resume-banner"
      onClick={() => actions.openOverlay('resumeSession')}
    >
      <div className="at-top-banner-main">
        <div className="at-top-banner-icon"><RotateCcw size={18} /></div>
        <div className="at-top-banner-text">
          <b>{t('resume.bannerTitle')}</b>
          <small>{t('resume.bannerSub')}</small>
        </div>
      </div>
    </button>
  );
};
