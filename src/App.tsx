import { useEffect, useState } from 'react';
import { LayoutDashboard, Dumbbell, LibraryBig, Sparkles, Scale, UtensilsCrossed } from 'lucide-react';
import { useStore } from './presentation/state/store';
import { BottomNav } from './ui/primitives/BottomNav';
import { QuickAdd } from './ui/primitives/QuickAdd';
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

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: <LayoutDashboard size={20} /> },
  { id: 'gym', label: 'Gym', icon: <Dumbbell size={20} /> },
  { id: 'exercises', label: 'Exercises', icon: <LibraryBig size={20} /> },
  { id: 'coach', label: 'Coach', icon: <Sparkles size={20} /> },
] as const;

type TabId = (typeof NAV_ITEMS)[number]['id'];

function App() {
  const { loadProfiles, profiles, activeProfile, activeTab, setActiveTab, addFoodLog, addManualMeasurement, startActiveSession } = useStore();
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  const [foodOpen, setFoodOpen] = useState(false);
  const [wtOpen, setWtOpen] = useState(false);

  useEffect(() => {
    loadProfiles();
    const timerExit = setTimeout(() => setSplashExiting(true), 1100);
    const timerRemove = setTimeout(() => setShowSplash(false), 1500);
    return () => {
      clearTimeout(timerExit);
      clearTimeout(timerRemove);
    };
  }, [loadProfiles]);

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

  const quickAddActions = [
    { id: 'weight', label: 'Log weight', icon: <Scale size={16} />, onClick: () => setWtOpen(true) },
    { id: 'food', label: 'Add food', icon: <UtensilsCrossed size={16} />, onClick: () => setFoodOpen(true) },
    { id: 'workout', label: 'Start workout', icon: <Dumbbell size={16} />, onClick: () => startActiveSession('Strength Training') },
  ];

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
          />
        )}
        {activeTab === 'gym' && <GymScreen />}
        {activeTab === 'exercises' && <ExerciseLibraryScreen />}
        {activeTab === 'coach' && <CoachScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>
      <FloatingWorkoutBar />
      <BottomNav
        items={[...NAV_ITEMS]}
        activeId={activeTab}
        onSelect={id => setActiveTab(id as TabId)}
      />
      <QuickAdd actions={quickAddActions} />
      <AddFoodSheet open={foodOpen} onClose={() => setFoodOpen(false)} onSubmit={e => addFoodLog(e)} />
      <LogWeightSheet open={wtOpen} onClose={() => setWtOpen(false)} onSubmit={w => addManualMeasurement(w)} />
    </>
  );
}

export default App;
