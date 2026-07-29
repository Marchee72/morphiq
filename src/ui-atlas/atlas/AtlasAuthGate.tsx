import React from 'react';
import { RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useT } from '../../i18n';
import { useStore } from '../../presentation/state/store';
import { resolveMode } from '../../presentation/state/preferences';
import { isGoogleConfigured } from '../../data/auth/googleSignIn';
import { AppMark } from './AppMark';
import { GoogleButton } from './GoogleButton';

/**
 * The wall in front of a server-backed deployment.
 *
 * It exists because the API is shared. Anyone with the URL reaches the same
 * database, and the only thing that decides whose training history they see is
 * the account they sign in with — so there is no sensible screen to show
 * someone who has not. Before this, a signed-out visitor fell through to the
 * onboarding form and every request it made came back 401.
 *
 * Rendered outside the app shell and inside its own `.at` wrapper, for the same
 * reason `AtlasSplash` is: the palette tokens are scoped to `.at`, and the shell
 * has not mounted at this point.
 */
export const AtlasAuthGate: React.FC<{
  /** True when the API could not be reached at all, which is not a rejection. */
  offline: boolean;
  onSignedIn: () => void;
  onRetry: () => void;
}> = ({ offline, onSignedIn, onRetry }) => {
  const { t } = useT();
  const mode = useStore(s => s.theme);

  return (
    <div className="at at-gate" data-mode={resolveMode(mode)}>
      <div className="at-gate-inner">
        <AppMark size={64} variant="mark" />

        <div className="at-gate-word">
          <h1 className="at-serif">MorphIQ</h1>
          <span>{t('gate.tagline')}</span>
        </div>

        {offline ? (
          <>
            <span className="at-gate-icon" data-warn="true"><WifiOff size={20} /></span>
            <h2 className="at-serif">{t('gate.offlineTitle')}</h2>
            <p>{t('gate.offlineBody')}</p>
            <button className="at-btn" onClick={onRetry} style={{ justifyContent: 'center' }}>
              <RefreshCw size={15} /> {t('gate.retry')}
            </button>
          </>
        ) : (
          <>
            <span className="at-gate-icon"><ShieldCheck size={20} /></span>
            <h2 className="at-serif">{t('gate.title')}</h2>
            <p>{t('gate.body')}</p>

            {isGoogleConfigured() ? (
              <GoogleButton onSignedIn={onSignedIn} />
            ) : (
              // A deployment that demands a session but ships no client id
              // cannot be signed into at all. Better to say so than to render a
              // button that does nothing.
              <p className="at-gate-note" role="alert">{t('gate.notConfigured')}</p>
            )}

            <p className="at-gate-note">{t('gate.privacy')}</p>
          </>
        )}
      </div>
    </div>
  );
};
