import React from 'react';
import { useStore } from '../../presentation/state/store';
import { resolveMode } from '../../presentation/state/preferences';
import { AppMark } from './AppMark';

/**
 * The launch screen.
 *
 * Renders the same mark the launcher icon is generated from, on the same sand
 * the app opens onto — so the transition from icon to app is continuous rather
 * than a colour jump.
 *
 * The `.at` wrapper is what makes it legible. Every palette token is scoped to
 * `.at`, and this screen renders outside the app shell — it has to, because it
 * covers the shell while the shell is still deciding what to be. Without the
 * wrapper `--sand` and `--cocoa` resolved to nothing: the background fell
 * through to the page and the wordmark inherited whatever `<body>` happened to
 * be, which in dark mode was a near-black figure and heading on a near-black
 * page. `data-mode` is read from the store rather than from `AppShell`, which
 * has not mounted yet at this point in the launch.
 */
export const AtlasSplash: React.FC<{ exiting: boolean }> = ({ exiting }) => {
  const mode = useStore(s => s.theme);
  const resolved = resolveMode(mode);

  return (
    <div
      className={`at at-splash${exiting ? ' exiting' : ''}`}
      data-mode={resolved}
      role="status"
      aria-label="MorphIQ"
    >
      {/* Sits behind the mark and breathes, so a slow cold start still reads as
          something happening rather than a frozen screen. */}
      <div className="at-splash-glow" aria-hidden="true" />

      <div className="at-splash-mark">
        <AppMark size={88} variant="mark" animated />
      </div>

      <div className="at-splash-word">
        <h1 className="at-serif">MorphIQ</h1>
        <span>Body Intelligence</span>
      </div>

      {/* Indeterminate: the load has no measurable progress, so this reports
          activity rather than inventing a percentage. */}
      <div className="at-splash-bar" aria-hidden="true"><i /></div>
    </div>
  );
};
