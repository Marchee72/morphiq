import React from 'react';
import { AppDataProvider } from './data/AppDataProvider';
import { AppActionsProvider } from './data/AppActionsProvider';
import { AppShell } from './shell/AppShell';

/**
 * Everything below the onboarding gate.
 *
 * Providers wrap the shell rather than the other way round, so `AppShell` can
 * read `ready` and render the skin's own skeleton while the first load settles.
 */
export const AppRoot: React.FC = () => (
  <AppDataProvider>
    <AppActionsProvider>
      <AppShell />
    </AppActionsProvider>
  </AppDataProvider>
);
