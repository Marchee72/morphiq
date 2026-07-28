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

function App() {
  const { loadProfiles, profiles, activeProfile } = useStore();
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);

  useEffect(() => {
    loadProfiles();
    const timerExit = setTimeout(() => setSplashExiting(true), 1100);
    const timerRemove = setTimeout(() => setShowSplash(false), 1500);
    return () => {
      clearTimeout(timerExit);
      clearTimeout(timerRemove);
    };
  }, [loadProfiles]);

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

  const splash = showSplash && <AtlasSplash exiting={splashExiting} />;

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
