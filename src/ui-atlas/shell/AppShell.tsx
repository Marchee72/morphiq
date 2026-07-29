import React, { useEffect } from 'react';
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
import { AtlasNav } from '../atlas/AtlasNav';
import { AtlasSkeleton } from '../atlas/AtlasStates';

import { AtlasTopInstallBanner } from '../atlas/AtlasTopInstallBanner';

import './app-base.css';
import '../atlas/atlas.css';

const SCREENS: Record<ScreenId, React.FC> = {
  today: AtlasToday,
  train: AtlasTrain,
  library: AtlasLibrary,
  body: AtlasBody,
  coach: AtlasCoach,
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

  return (
    <div className="app at" data-mode={resolved}>
      <div className="app-statusbar" />
      <AtlasTopInstallBanner />
      {/* Keyed on the tab so switching screens resets scroll. */}
      <div className="app-scroll" key={screen}>
        {ready ? <Screen /> : <AtlasSkeleton />}
      </div>
      <AtlasNav active={screen} onNavigate={setActiveTab} />
      <AppOverlays onClose={actions.closeOverlay} />
    </div>
  );
};
