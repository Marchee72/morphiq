import React from 'react';
import { AppMark } from './AppMark';

/**
 * The launch screen.
 *
 * Renders the same mark the launcher icon is generated from, on the same sand
 * the app opens onto — so the transition from icon to app is continuous rather
 * than a colour jump. The previous splash used the app's default token
 * background and a blue PNG that matched nothing in the interface.
 */
export const AtlasSplash: React.FC<{ exiting: boolean }> = ({ exiting }) => (
  <div className={`at-splash${exiting ? ' exiting' : ''}`} role="status" aria-label="MorphIQ">
    <div className="at-splash-mark">
      <AppMark size={88} variant="mark" />
    </div>
    <div className="at-splash-word">
      <h1 className="at-serif">MorphIQ</h1>
      <span>Body Intelligence</span>
    </div>
  </div>
);
