import React from 'react';
import { AppDataProvider } from './data/AppDataProvider';
import { AppActionsProvider } from './data/AppActionsProvider';
import { SocialProvider } from './data/SocialProvider';
import { AppShell } from './shell/AppShell';

/**
 * Everything below the onboarding gate.
 *
 * Providers wrap the shell rather than the other way round, so `AppShell` can
 * read `ready` and render the skin's own skeleton while the first load settles.
 *
 * `SocialProvider` sits innermost because it is the only one that changes on its
 * own: a partner's list arrives while nobody is touching the app, and any higher
 * would make every screen re-render for it.
 */
export const AppRoot: React.FC = () => (
  <AppDataProvider>
    <AppActionsProvider>
      <SocialProvider>
        <AppShell />
      </SocialProvider>
    </AppActionsProvider>
  </AppDataProvider>
);
