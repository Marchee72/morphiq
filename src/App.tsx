import { useCallback, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useStore } from './presentation/state/store';
import { handleGlobalBack } from './presentation/state/backHandler';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { CapacitorHealthProvider } from './data/health/CapacitorHealthProvider';
import { WebHealthProvider } from './data/health/WebHealthProvider';
import type { IHealthProvider } from './core/interfaces/IHealthProvider';
import { probeGate, type GateStatus } from './data/auth/authGate';
import { onSessionCleared } from './data/auth/session';
import { FloatingWorkoutBar } from './features/gym/FloatingWorkoutBar';
import { AppRoot } from './ui-atlas/AppRoot';
import { AtlasSplash } from './ui-atlas/atlas/AtlasSplash';
import { AtlasAuthGate } from './ui-atlas/atlas/AtlasAuthGate';
import { AtlasErrorBoundary } from './ui-atlas/atlas/AtlasErrorBoundary';
import { HEALTH_IMPORT_DAYS } from './ui-atlas/derive/bodyMetrics';

/** The splash holds for at least this long, so a fast load does not flash it. */
const SPLASH_MIN_MS = 1100;
/** Long enough for the splash's own exit animation to finish. */
const SPLASH_FADE_MS = 400;
/**
 * Last resort. Nothing should reach this — the profile query is a single lookup
 * — but a request that never answers must not hold the app hostage. Better a
 * wrong screen you can act on than a splash that never leaves.
 */
const SPLASH_MAX_MS = 8000;
/** Enough for Today's step card and the week behind it in its detail sheet. */
const STEP_HISTORY_DAYS = 7;
/** Workouts only ever feed recent history, so they keep their own shorter reach. */
const WORKOUT_HISTORY_DAYS = 30;

function App() {
  const { loadProfiles, profiles, activeProfile } = useStore();
  const profilesLoaded = useStore(s => s.profilesLoaded);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [gaveUpWaiting, setGaveUpWaiting] = useState(false);
  const [splashGone, setSplashGone] = useState(false);

  /**
   * Whether this deployment will show anything without an account.
   *
   * Asked before the profiles are trusted: against a server that enforces auth,
   * `loadProfiles` returns nothing for a signed-out visitor, and an empty list
   * is indistinguishable from "new user" — which is how a stranger used to land
   * in the onboarding form and watch every field fail to save.
   */
  const [gate, setGate] = useState<GateStatus>('checking');

  const checkGate = useCallback(() => {
    setGate('checking');
    probeGate().then(setGate, () => setGate('offline'));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    probeGate(controller.signal).then(setGate, () => setGate('offline'));
    const minTimer = setTimeout(() => setMinTimeElapsed(true), SPLASH_MIN_MS);
    const maxTimer = setTimeout(() => setGaveUpWaiting(true), SPLASH_MAX_MS);
    return () => {
      controller.abort();
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, []);

  // Profiles are only worth loading once we know we are allowed to see any.
  // `offline-cached` counts: the load serves from the snapshot, and it *has* to
  // run — an empty `profiles` below reads as "new user" and opens the sign-up
  // form, which is the worst possible screen to land an offline user on.
  useEffect(() => {
    if (gate !== 'open' && gate !== 'offline-cached') return;
    loadProfiles().catch(err => console.error('Failed to load profiles', err));
  }, [gate, loadProfiles]);

  /**
   * Re-asks once the connection comes back.
   *
   * Entering on a cached snapshot leaves one question genuinely unanswered:
   * whether the server still accepts this session. Asking again on `online` and
   * on app resume settles it — and if the answer is now `blocked`, the wall goes
   * up through the same path a mid-session 401 uses.
   */
  useEffect(() => {
    if (gate !== 'offline-cached') return;

    const recheck = () => { void probeGate().then(setGate, () => {}); };
    window.addEventListener('online', recheck);
    const resumed = CapApp.addListener('resume', recheck);

    return () => {
      window.removeEventListener('online', recheck);
      void resumed.then(l => l.remove());
    };
  }, [gate]);

  /**
   * A token rejected mid-session puts the wall straight back up.
   *
   * `ServerDatabase` clears the session on any 401 and throws; without this the
   * app carried on showing stale screens whose every reload failed silently.
   */
  useEffect(() => onSessionCleared(() => setGate('blocked')), []);

  /**
   * The splash leaves when the answer is actually there, not on a fixed timer.
   * It used to disappear after 1.5s regardless, and since `profiles` is `[]`
   * until the load resolves, a slower start showed the onboarding form to
   * someone who already had a profile.
   *
   * It waits only for "is there an account", never for the profile's data —
   * that streams in behind the app shell, which renders its own skeleton.
   *
   * Once the gate answers anything but `open` there are no profiles coming, so
   * waiting on `profilesLoaded` would hold the splash for the full eight-second
   * timeout in front of a sign-in screen that was ready immediately.
   */
  const ready = gate === 'open' || gate === 'offline-cached'
    ? profilesLoaded
    : gate !== 'checking';
  const splashDone = (ready && minTimeElapsed) || gaveUpWaiting;

  useEffect(() => {
    if (!splashDone) return;
    const timer = setTimeout(() => setSplashGone(true), SPLASH_FADE_MS);
    return () => clearTimeout(timer);
  }, [splashDone]);

  // Android hardware back and the swipe-back gesture, in priority order:
  // an open overlay, then the tab stack, then leave the app.
  useEffect(() => {
    const handleBack = () => {
      if (handleGlobalBack()) return;

      const { activeTab, setActiveTab } = useStore.getState();
      if (activeTab !== 'today') {
        setActiveTab('today');
      } else {
        CapApp.minimizeApp();
      }
    };

    const listener = CapApp.addListener('backButton', handleBack);
    window.addEventListener('popstate', handleBack);

    return () => {
      listener.then(l => l.remove());
      window.removeEventListener('popstate', handleBack);
    };
  }, []);

  useEffect(() => {
    if (!activeProfile) return;

    const provider = new CapacitorHealthProvider();
    const fallback = new WebHealthProvider();
    // Typed as the interface, not as the union of the two classes: every optional
    // method below is guarded, and inferring the union means the web provider's
    // missing methods are compile errors rather than the runtime absences the
    // guards already handle.
    const healthProvider: IHealthProvider = provider.isAvailable() ? provider : fallback;

    let cancelled = false;
    let permitted = false;

    /**
     * Steps for the last week, which Today reads today's figure out of.
     *
     * Separate from the workout import because it is the one health value that
     * goes stale while you look at it — the import is a once-per-launch job,
     * this re-runs whenever the app comes back to the foreground.
     */
    const readSteps = async () => {
      if (!permitted || !healthProvider.getDailySteps) return;
      try {
        const since = new Date();
        since.setDate(since.getDate() - STEP_HISTORY_DAYS);
        since.setHours(0, 0, 0, 0);
        const days = await healthProvider.getDailySteps(since);
        if (!cancelled) useStore.getState().setDailySteps(days);
      } catch (err) { console.warn('Step sync failed', err); }
    };

    /**
     * Weigh-ins, over the window the Body charts are drawn for.
     *
     * Split out of `autoSync` so the resume listener can call it too. It used to
     * run once per launch, which meant stepping off the scale and returning to a
     * backgrounded app showed yesterday's weight until you killed the app.
     * Re-running is cheap and idempotent: `importMeasurements` dedupes by minute
     * against what is already in Dexie, so a repeat import writes nothing.
     */
    const readBodyComposition = async () => {
      if (!permitted || !healthProvider.importBodyComposition) return;
      try {
        const since = new Date();
        since.setDate(since.getDate() - HEALTH_IMPORT_DAYS);
        const measurements = await healthProvider.importBodyComposition(since, activeProfile);
        if (!cancelled && measurements.length > 0) {
          await useStore.getState().importMeasurements(measurements);
        }
      } catch (err) { console.warn('Body composition sync failed', err); }
    };

    /**
     * Activities the watch recorded, over the window history is drawn for.
     *
     * Same reasoning as `readBodyComposition` above, for the same reason: this
     * used to run once per launch, so finishing a session on the watch and
     * returning to a backgrounded app showed nothing until you killed it — which
     * is the moment you go to Settings and press Sync by hand. Re-running is
     * idempotent: `importWorkouts` dedupes on `externalId` against the 30 days
     * already in the database, and the merge into a manual session moves that
     * `externalId` onto the survivor so a repeat import matches it too.
     */
    const readWorkouts = async () => {
      if (!permitted) return;
      try {
        const since = new Date();
        since.setDate(since.getDate() - WORKOUT_HISTORY_DAYS);
        const workouts = await healthProvider.importWorkouts(since);
        if (!cancelled) await useStore.getState().importWorkouts(workouts);
      } catch (err) { console.warn('Workout sync failed', err); }
    };

    /**
     * Sleep and heart signals, folded into the wellness day they belong to.
     *
     * Same window as the body charts, and idempotent for the same reason the
     * others are: a day whose numbers have not changed is skipped rather than
     * rewritten. It never touches the four self-reported scales — Health Connect
     * has no record type for stress, mood or soreness, so those only ever come
     * from the questionnaire.
     */
    const readWellness = async () => {
      if (!permitted || !healthProvider.importWellnessSignals) return;
      try {
        const since = new Date();
        since.setDate(since.getDate() - HEALTH_IMPORT_DAYS);
        const signals = await healthProvider.importWellnessSignals(since);
        if (!cancelled) await useStore.getState().importWellnessSignals(signals);
      } catch (err) { console.warn('Wellness sync failed', err); }
    };

    const autoSync = async () => {
      try {
        permitted = await healthProvider.requestPermissions();
        if (permitted) {
          await readBodyComposition();
          await readWorkouts();
          await readSteps();
          await readWellness();
        }
      } catch (err) { console.error('Health sync error:', err); }
    };
    autoSync();

    const resumed = CapApp.addListener('resume', () => {
      // Nothing was granted at launch, so there is nothing to re-read — ask
      // again instead. Granting in Health Connect means leaving the app and
      // coming back, and this is that moment: without it, permission given from
      // its settings screen did nothing until the app was killed and relaunched.
      if (!permitted) { void autoSync(); return; }
      void readSteps();
      void readBodyComposition();
      void readWorkouts();
      void readWellness();
    });
    return () => {
      cancelled = true;
      resumed.then(l => l.remove());
    };
  }, [activeProfile]);

  const splash = !splashGone && <AtlasSplash exiting={splashDone} />;

  // Still asking the server whether an account is required.
  if (gate === 'checking' && !gaveUpWaiting) return <>{splash}</>;

  /**
   * No session against a server that insists on one.
   *
   * This has to come before the profile check: signed out, `loadProfiles`
   * returns an empty list, and the branch below would read that as a new user
   * and open the sign-up form — which then fails on every write.
   */
  // `offline-cached` deliberately falls through to the app: there is a snapshot
  // taken under this account, so there is something honest to show, and every
  // write from here goes to the outbox. A real 401 still lands on `blocked`.
  if (gate === 'blocked' || gate === 'offline') {
    return (
      <>
        {splash}
        <AtlasAuthGate
          offline={gate === 'offline'}
          onSignedIn={checkGate}
          onRetry={checkGate}
        />
      </>
    );
  }

  // Nothing is known yet — an empty `profiles` here means "not loaded", not
  // "no account". Deciding between the app and the sign-up form has to wait.
  if (!profilesLoaded && !gaveUpWaiting) return <>{splash}</>;

  // Onboarding runs before there is a profile to load, so it sits outside the
  // app shell — but inside its own `.at` wrapper, so it looks like the app.
  if (profiles.length === 0) {
    return (<>{splash}<OnboardingScreen /></>);
  }

  return (
    <>
      {splash}
      <AtlasErrorBoundary onReset={() => useStore.getState().setActiveTab('today')}>
        <AppRoot />
      </AtlasErrorBoundary>
      {/* Renders nothing — it drives the Android live-workout notification. */}
      <FloatingWorkoutBar />
    </>
  );
}

export default App;
