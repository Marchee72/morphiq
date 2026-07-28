import { useContext } from 'react';
import { AppActionsContext, AppDataContext, AppUiContext } from './contexts';
import type { AppActions, AppData, AppUiState } from './types';

/**
 * The single seam every skin screen reads through.
 *
 * Screens in the design showcase reached into module-scope mock singletons at
 * render time (`sessionExercises[1]`, `metricByKey('weight')`). Porting them
 * meant replacing those imports with one of these hooks — no props threading,
 * because both skins want exactly the same data and threading it would mean ten
 * prop interfaces to keep in sync for no benefit.
 */
export function useAppData(): AppData {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData must be used inside <AppDataProvider>');
  return value;
}

export function useAppActions(): AppActions {
  const value = useContext(AppActionsContext);
  if (!value) throw new Error('useAppActions must be used inside <AppActionsProvider>');
  return value;
}

export function useAppUi(): AppUiState {
  return useContext(AppUiContext);
}

export type { AppData, AppActions, AppUiState, OverlayId } from './types';
