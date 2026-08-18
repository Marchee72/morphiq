import React, { useMemo, useState } from 'react';
import { useStore } from '../../presentation/state/store';
import { latestRoutineIn } from '../components/useCoachThread';

/**
 * Every callback both skins need, in one stable-identity object.
 *
 * Split from `AppDataContext` so a data tick does not invalidate the action
 * bundle (and vice-versa). This is also the single place the showcase's dead
 * buttons get wired — in the concepts as designed, the rail headings, `.st-bar`
 * buttons, moment cards and set-add pill were all `<button>`s with no handler.
 */

import type { AppActions, AppUiState } from './types';
import { AppActionsContext, AppUiContext } from './contexts';

const CLOSED: AppUiState = { overlay: null, payload: {} };

export const AppActionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Overlay and payload move together — a payload that outlived its overlay would
  // make the next "add exercise" silently swap.
  const [ui, setUi] = useState<AppUiState>(CLOSED);

  // Actions are read from the store imperatively rather than subscribed to, so
  // this object's identity never changes and no screen re-renders because of it.
  const actions: AppActions = useMemo(() => ({
    navigate: screen => useStore.getState().setActiveTab(screen),
    openOverlay: (overlay, payload = {}) => setUi({ overlay, payload }),
    closeOverlay: () => setUi(CLOSED),

    startSession: type => {
      useStore.getState().startActiveSession(type);
      useStore.getState().setActiveTab('train');
    },
    beginSession: () => {
      const store = useStore.getState();
      // A sheet whose only option is "empty session" is a tap tax. It appears
      // once there is something to choose between.
      const hasChoices = store.savedRoutines.length > 0 || latestRoutineIn(store.chatHistory) !== null;
      if (hasChoices) {
        setUi({ overlay: 'startSession', payload: {} });
        return;
      }
      store.startActiveSession();
      store.setActiveTab('train');
    },
    startRoutine: routine => {
      /**
       * Every "start this routine" button in the app lands here, so this is the
       * one place the guard has to exist. Starting a routine used to replace
       * `activeSession` outright — sets and all — with no confirmation.
       */
      if (useStore.getState().activeSession) {
        setUi({ overlay: 'routineMerge', payload: { routine } });
        return;
      }
      useStore.getState().startActiveSessionWithRoutine(routine, routine.id ? 'template' : 'coach');
      useStore.getState().setActiveTab('train');
    },
    applyRoutine: (routine, mode) =>
      useStore.getState().mergeRoutineIntoActiveSession(routine, mode),
    finishSession: async () => {
      await useStore.getState().finishActiveSession();
      // Reload so the session that just ended appears in history and records.
      await useStore.getState().loadAllSets();
      useStore.getState().setActiveTab('today');
    },
    discardSession: () => {
      useStore.getState().dismissActiveSession();
      useStore.getState().setActiveTab('today');
    },

    logWeight: (kg, bia) => useStore.getState().addManualMeasurement(kg, bia),
    toggleFavorite: id => useStore.getState().toggleFavorite(id),
    sendCoachMessage: text => useStore.getState().sendChatMessage(text),

    loadOlderHistory: async (from, to) => {
      await useStore.getState().extendWorkoutHistory(from, to);
      // The logs arrive without their sets; this is what gives them a volume.
      await useStore.getState().loadAllSets();
    },
  }), []);

  return (
    <AppActionsContext.Provider value={actions}>
      <AppUiContext.Provider value={ui}>{children}</AppUiContext.Provider>
    </AppActionsContext.Provider>
  );
};
