import { useEffect, useState } from 'react';
import { LayoutDashboard, Dumbbell, LibraryBig, Sparkles, Plus } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import { useStore } from './presentation/state/store';
import { handleGlobalBack } from './presentation/state/backHandler';
import { BottomNav } from './ui/primitives/BottomNav';
import { QuickAddSheet } from './ui/primitives/QuickAdd';
import { buildQuickAddActions } from './ui/quickAddActions';
import { HomeScreen } from './features/home/HomeScreen';
import { GymScreen } from './features/gym/GymScreen';
import { ExerciseLibraryScreen } from './features/exercises/ExerciseLibraryScreen';
import { CoachScreen } from './features/coach/CoachScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { AddFoodSheet } from './features/home/AddFoodSheet';
import { LogWeightSheet } from './features/home/LogWeightSheet';
import { CapacitorHealthProvider } from './data/health/CapacitorHealthProvider';
import { WebHealthProvider } from './data/health/WebHealthProvider';
import { FloatingWorkoutBar } from './features/gym/FloatingWorkoutBar';

import { LiveWorkoutScreen } from './features/gym/LiveWorkoutScreen';
import { ErrorBoundary } from './ui/primitives/ErrorBoundary';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: <LayoutDashboard size={22} /> },
  { id: 'gym', label: 'Gym', icon: <Dumbbell size={22} /> },
  { id: 'exercises', label: 'Exercises', icon: <LibraryBig size={22} /> },
  { id: 'coach', label: 'Coach', icon: <Sparkles size={22} /> },
] as const;

type TabId = (typeof NAV_ITEMS)[number]['id'];

function App() {
  const {
    loadProfiles,
    profiles,
    activeProfile,
    activeTab,
    setActiveTab,
    addFoodLog,
    addManualMeasurement,
    startActiveSession,
    isGymModeOpen,
    setIsGymModeOpen,
  } = useStore();
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [wtOpen, setWtOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    loadProfiles();
    const timerExit = setTimeout(() => setSplashExiting(true), 1100);
    const timerRemove = setTimeout(() => setShowSplash(false), 1500);
    return () => {
      clearTimeout(timerExit);
      clearTimeout(timerRemove);
    };
  }, [loadProfiles]);

  // Handle native Android hardware back button and swipe back gesture
  useEffect(() => {
    const handleBack = () => {
      // 1. Try closing open modal/sheet from the stack
      const handled = handleGlobalBack();
      if (handled) return;

      // 2. If no open modal was handled, check active tab
      const { activeTab: currentTab, setActiveTab: setTab } = useStore.getState();
      if (currentTab !== 'home') {
        setTab('home');
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
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeTab]);

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

  const quickAddActions = buildQuickAddActions({
    onLogWeight: () => setWtOpen(true),
    onAddFood: () => setFoodOpen(true),
    onStartWorkout: () => startActiveSession('Strength Training'),
  });

  const splash = showSplash && (
    <div
      className={`ui-splash-container ${splashExiting ? 'exiting' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: 'var(--ui-bg)',
      }}
    >
      <img
        src="/app_icon.png"
        alt="MorphIQ"
        className="ui-splash-icon"
        style={{ width: 96, height: 96, borderRadius: 'var(--ui-radius-sheet)', objectFit: 'cover' }}
      />
      <div className="ui-splash-text" style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--ui-font)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--ui-text-primary)' }}>MorphIQ</h1>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ui-text-secondary)', marginTop: 4, display: 'block' }}>
          Body Intelligence
        </span>
      </div>
    </div>
  );

  if (profiles.length === 0) {
    return (<>{splash}<OnboardingScreen /></>);
  }

  return (
    <>
      {splash}
      <main style={{ flex: 1 }}>
        {activeTab === 'home' && (
          <HomeScreen
            onOpenSettings={() => setActiveTab('settings')}
            onOpenFoodSheet={() => setFoodOpen(true)}
            onOpenWeightSheet={() => setWtOpen(true)}
            quickAddButton={
              <button
                type="button"
                className="ui-icon-btn"
                aria-label="Quick add"
                onClick={() => setQuickAddOpen(true)}
              >
                <Plus size={20} />
              </button>
            }
          />
        )}
        {activeTab === 'gym' && <GymScreen />}
        {activeTab === 'exercises' && <ExerciseLibraryScreen />}
        {activeTab === 'coach' && <CoachScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>
      <FloatingWorkoutBar />
      <ErrorBoundary fallbackTitle="Error en Pantalla de Entrenamiento" onReset={() => setIsGymModeOpen(false)}>
        <LiveWorkoutScreen isOpen={isGymModeOpen} onClose={() => setIsGymModeOpen(false)} />
      </ErrorBoundary>
      <BottomNav
        items={[...NAV_ITEMS]}
        activeId={activeTab}
        onSelect={id => setActiveTab(id as TabId)}
      />
      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} actions={quickAddActions} />
      <AddFoodSheet open={foodOpen} onClose={() => setFoodOpen(false)} onSubmit={e => addFoodLog(e)} />
      <LogWeightSheet open={wtOpen} onClose={() => setWtOpen(false)} onSubmit={w => addManualMeasurement(w)} />
    </>
  );
}

export default App;
