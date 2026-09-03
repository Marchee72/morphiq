import React, { useEffect, useRef } from 'react';
import { useStore } from '../../presentation/state/store';
import { resolveMode, SURFACE } from '../../presentation/state/preferences';
import { useAppData, useAppActions } from '../data/useAppData';
import type { ScreenId } from '../types';
import { AppOverlays } from './AppOverlays';

import { AtlasToday } from '../atlas/AtlasToday';
import { AtlasTrain } from '../atlas/AtlasTrain';
import { AtlasLibrary } from '../atlas/AtlasLibrary';
import { AtlasBody } from '../atlas/AtlasBody';
import { AtlasCoach } from '../atlas/AtlasCoach';
import { AtlasBuddies } from '../atlas/AtlasBuddies';
import { AtlasNav } from '../atlas/AtlasNav';
import { AtlasSkeleton } from '../atlas/AtlasStates';

import { AtlasTopInstallBanner } from '../atlas/AtlasTopInstallBanner';
import { AtlasSyncBanner } from '../atlas/AtlasSyncBanner';

import './app-base.css';
import '../atlas/atlas.css';

const SCREENS: Record<ScreenId, React.FC> = {
  today: AtlasToday,
  train: AtlasTrain,
  library: AtlasLibrary,
  body: AtlasBody,
  coach: AtlasCoach,
  buddies: AtlasBuddies,
};

export const AppShell: React.FC = () => {
  const mode = useStore(s => s.theme);
  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);
  const { ready } = useAppData();
  const actions = useAppActions();

  const screen: ScreenId = activeTab === 'settings' ? 'today' : activeTab;
  const Screen = SCREENS[screen];
  const resolved = resolveMode(mode);

  // `color-scheme` on the root still drives native form controls, the on-screen
  // keyboard and scrollbars, so the resolved mode is mirrored there even though
  // the palette itself is scoped to the wrapper.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', SURFACE[resolved]);
  }, [resolved]);

  /**
   * Offers back a session the app died holding.
   *
   * Waits for `ready` because the store reads the stored session at creation,
   * long before there is an active profile to match it against — asking first
   * would mean asking about somebody else's workout on a shared device.
   *
   * The ref makes it a once-per-launch question. Without it, dismissing the
   * sheet re-opens it on the next render, and there is no way past it.
   */
  const askedToResume = useRef(false);
  useEffect(() => {
    if (!ready || askedToResume.current) return;

    const { pendingResume, activeProfile, activeSession } = useStore.getState();
    // A live session already on screen outranks a stored one — this only ever
    // happens if a workout was started before `ready` flipped, and the one in
    // front of the user is the one they are doing.
    if (!pendingResume || activeSession) return;
    if (pendingResume.profileId !== activeProfile?.id) return;

    askedToResume.current = true;
    actions.openOverlay('resumeSession');
  }, [ready, actions]);

  return (
    <div className="app at" data-mode={resolved}>
      <div className="app-statusbar" />
      <AtlasTopInstallBanner />
      {/* Above the scroll region: "the server cannot be reached" is a fact
          about the app, not about the screen you happen to be on. */}
      <AtlasSyncBanner />
      {/* Keyed on the tab so switching screens resets scroll. */}
      <div className="app-scroll" key={screen}>
        {ready ? <Screen /> : <AtlasSkeleton />}
      </div>
      <AtlasNav active={screen} onNavigate={setActiveTab} />
      <AppOverlays onClose={actions.closeOverlay} />
    </div>
  );
};
