import React, { useState } from 'react';
import { useT } from '../../i18n';
import { signInWithGoogle, isGoogleConfigured } from '../../data/auth/googleSignIn';
import { useStore } from '../../presentation/state/store';
import { useSocialStore } from '../../presentation/state/socialStore';

/** Google's mark, inlined — a remote image would fail offline and on a cold WebView. */
const GoogleG: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.500h7.1c4.1-3.8 6.6-9.4 6.6-16.1z" />
    <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17 2.1 20.4 2.1 24s.9 7 2.4 9.9l7.3-5.7z" />
    <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
  </svg>
);

/**
 * Sign in with Google.
 *
 * Renders nothing when no client id is configured, so a local-only build has no
 * dead button offering something that cannot work.
 */
export const GoogleButton: React.FC<{
  onSignedIn?: (adoptedProfiles: number) => void;
  variant?: 'primary' | 'ghost';
}> = ({ onSignedIn, variant = 'primary' }) => {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isGoogleConfigured()) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      // `available` is computed once, at module load — true everywhere else,
      // but a sign-in happening mid-session is exactly the moment it goes
      // stale. Every entry point funnels through here, so this is the one
      // place that needs to know: friendships just became possible.
      const profileId = useStore.getState().activeProfile?.id;
      if (profileId) void useSocialStore.getState().load(profileId);
      onSignedIn?.(result.adoptedProfiles);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      setError(err instanceof Error ? err.message : t('auth.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="at-google"
        data-ghost={variant === 'ghost'}
        onClick={run}
        disabled={busy}
      >
        <GoogleG />
        {busy ? t('auth.signingIn') : t('auth.google')}
      </button>
      {error && <span className="at-field-hint" role="alert">{error}</span>}
    </>
  );
};
