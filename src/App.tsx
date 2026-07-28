import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { useStore } from './presentation/state/store';
import { handleGlobalBack } from './presentation/state/backHandler';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { CapacitorHealthProvider } from './data/health/CapacitorHealthProvider';
import { WebHealthProvider } from './data/health/WebHealthProvider';
import { FloatingWorkoutBar } from './features/gym/FloatingWorkoutBar';
import { AppRoot } from './ui-atlas/AppRoot';
import { AtlasSplash } from './ui-atlas/atlas/AtlasSplash';
import { AtlasErrorBoundary } from './ui-atlas/atlas/AtlasErrorBoundary';

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

function App() {
  const { loadProfiles, profiles, activeProfile } = useStore();
  const profilesLoaded = useStore(s => s.profilesLoaded);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [gaveUpWaiting, setGaveUpWaiting] = useState(false);
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    loadProfiles().catch(err => console.error('Failed to load profiles', err));
    const minTimer = setTimeout(() => setMinTimeElapsed(true), SPLASH_MIN_MS);
    const maxTimer = setTimeout(() => setGaveUpWaiting(true), SPLASH_MAX_MS);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
    };
  }, [loadProfiles]);

  /**
   * The splash leaves when the answer is actually there, not on a fixed timer.
   * It used to disappear after 1.5s regardless, and since `profiles` is `[]`
   * until the load resolves, a slower start showed the onboarding form to
   * someone who already had a profile.
   *
   * It waits only for "is there an account", never for the profile's data —
   * that streams in behind the app shell, which renders its own skeleton.
   */
  const splashDone = (profilesLoaded && minTimeElapsed) || gaveUpWaiting;

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
    const autoSync = async () => {
      try {
        const provider = new CapacitorHealthProvider();
        const fallback = new WebHealthProvider();
        const healthProvider = provider.isAvailable() ? provider : fallback;
        const granted = await healthProvider.requestPermissions();
        if (granted) {
          const since = new Date(); since.setDate(since.getDate() - 30);
          const workouts = await healthProvider.importWorkouts(since);
          if (healthProvider.importBodyComposition) {
            const measurements = await healthProvider.importBodyComposition(since, activeProfile);
            if (measurements.length > 0) await useStore.getState().importMeasurements(measurements);
          }
          await useStore.getState().importWorkouts(workouts);
        }
      } catch (err) { console.error('Health sync error:', err); }
    };
    autoSync();
  }, [activeProfile]);

  const splash = !splashGone && <AtlasSplash exiting={splashDone} />;

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
