import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { useStore } from '../../presentation/state/store';
import { resolveMode, SURFACE } from '../../presentation/state/preferences';
import { useAppData, useAppActions, useAppUi } from '../data/useAppData';
import { useHealthSync } from '../data/useHealthSync';
import { usePullToRefresh } from '../components/usePullToRefresh';
import { useTabSwipe } from '../components/useTabSwipe';
import { SCREENS as ORDER, type ScreenId } from '../types';
import { AppOverlays } from './AppOverlays';
import { AtlasPullRefresh } from '../atlas/AtlasPullRefresh';

import { AtlasToday } from '../atlas/AtlasToday';
import { AtlasTrain } from '../atlas/AtlasTrain';
import { AtlasLibrary } from '../atlas/AtlasLibrary';
import { AtlasBody } from '../atlas/AtlasBody';
import { AtlasCoach } from '../atlas/AtlasCoach';
import { AtlasBuddies } from '../atlas/AtlasBuddies';
import { AtlasNav } from '../atlas/AtlasNav';
import { AtlasSkeleton, type SkeletonShape } from '../atlas/AtlasStates';
import { RefreshCw } from 'lucide-react';
import { useT } from '../../i18n';

import { AtlasTopInstallBanner } from '../atlas/AtlasTopInstallBanner';
import { AtlasSyncBanner } from '../atlas/AtlasSyncBanner';
import { AtlasResumeBanner } from '../atlas/AtlasResumeBanner';

import './app-base.css';
import '../tw.css';
import '../atlas/atlas.css';

/** The skeleton each screen shows before the first data arrives. */
const SKELETON: Record<ScreenId, SkeletonShape> = {
  today: 'today', train: 'train', library: 'library', body: 'body', coach: 'coach', buddies: 'buddies',
};

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
  const { t } = useT();
  const actions = useAppActions();

  const screen: ScreenId = activeTab === 'settings' ? 'today' : activeTab;
  const Screen = SCREENS[screen];
  const resolved = resolveMode(mode);
  const { overlay } = useAppUi();
  const liveSession = useStore(s => s.activeSession != null);

  /**
   * Which way the last tab change went, so the new screen slides in from that
   * side. Kept as state updated during render (React's "store information
   * from previous renders"), not a ref, so it is right on the very render
   * that mounts the new screen.
   */
  const index = ORDER.findIndex(s => s.id === screen);
  const [nav, setNav] = useState({ index, dir: 0 });
  if (nav.index !== index) setNav({ index, dir: Math.sign(index - nav.index) });

  /**
   * Sideways between tabs — except on Train during a session, where the same
   * gesture changes exercise, and while an overlay is up.
   */
  const swipe = useTabSwipe({
    enabled: ready && !overlay && !(screen === 'train' && liveSession),
    canPrev: index > 0,
    canNext: index < ORDER.length - 1,
    onPrev: () => setActiveTab(ORDER[index - 1].id),
    onNext: () => setActiveTab(ORDER[index + 1].id),
  });

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

  /**
   * Pull down to pull in — from Health Connect, which is the door Samsung Health
   * writes through.
   *
   * Only on the two screens made of that data. Train is a live session with a
   * horizontal swipe of its own and a clock that must not stall behind a network
   * import; Library, Coach and Buddies hold nothing Health Connect has ever
   * heard of, and a gesture that appears to do something and does nothing is
   * worse than no gesture.
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  const canPull = ready && (screen === 'today' || screen === 'body');

  /** The last sync's outcome, kept on screen briefly once the spinner is gone. */
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const { sync } = useHealthSync();

  const onRefresh = useCallback(async () => {
    const result = await sync();
    setSyncNote(result.message || null);
  }, [sync]);

  const pull = usePullToRefresh(scrollRef, onRefresh, canPull);

  // The result is an answer to a gesture, not a status bar — it says what the
  // pull did and then gets out of the way.
  useEffect(() => {
    if (!syncNote) return;
    const timer = setTimeout(() => setSyncNote(null), 2600);
    return () => clearTimeout(timer);
  }, [syncNote]);

  return (
    // `reducedMotion="user"`: every motion component follows the OS setting,
    // so no animation has to check it on its own.
    <MotionConfig reducedMotion="user">
    <div className="app at" data-mode={resolved} data-screen={screen}>
      <div className="app-statusbar" />
      <AtlasTopInstallBanner />
      {/* Above the scroll region: "the server cannot be reached" is a fact
          about the app, not about the screen you happen to be on. */}
      <AtlasSyncBanner />
      {/* Same slot, for the same reason: closing the resume sheet without
          answering it leaves a workout stored and unreachable, and the way back
          to it belongs above the screens rather than on one of them. */}
      <AtlasResumeBanner />
      {/* Keyed on the tab so switching screens resets scroll, and slides in
          from the side the tab change went. Only on a change: the first
          screen of a launch just appears. Both transforms end at none, so a
          sheet opened from a screen is never trapped inside it. */}
      <motion.div
        className="app-scroll"
        key={screen}
        ref={scrollRef}
        data-pullable={canPull}
        initial={nav.dir === 0 ? false : { x: nav.dir * 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ x: { type: 'spring', stiffness: 380, damping: 36 }, opacity: { duration: 0.18 } }}
        {...swipe.bind}
      >
        <AtlasPullRefresh state={pull.state} message={syncNote} />
        {!ready && (
          <span className="at-syncing-pill" role="status">
            <RefreshCw size={13} className="at-spin" /> {t('sync.syncing')}
          </span>
        )}
        <motion.div className="app-screen" style={{ x: swipe.x }}>
          {ready ? <Screen /> : <AtlasSkeleton shape={SKELETON[screen]} />}
        </motion.div>
      </motion.div>
      <AtlasNav active={screen} onNavigate={setActiveTab} />
      <AppOverlays onClose={actions.closeOverlay} />
    </div>
    </MotionConfig>
  );
};
