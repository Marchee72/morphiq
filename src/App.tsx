import { useEffect, useState } from 'react';
import { LayoutDashboard, Dumbbell, LibraryBig, Sparkles } from 'lucide-react';
import { useStore } from './presentation/state/store';
import { BottomNav } from './ui/primitives/BottomNav';
import { HomeScreen } from './features/home/HomeScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { ComingSoonScreen } from './features/placeholder/ComingSoonScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { CapacitorHealthProvider } from './data/health/CapacitorHealthProvider';
import { WebHealthProvider } from './data/health/WebHealthProvider';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: <LayoutDashboard size={22} /> },
  { id: 'gym', label: 'Gym', icon: <Dumbbell size={22} /> },
  { id: 'exercises', label: 'Exercises', icon: <LibraryBig size={22} /> },
  { id: 'coach', label: 'Coach', icon: <Sparkles size={22} /> },
] as const;

type TabId = (typeof NAV_ITEMS)[number]['id'];

function App() {
  const { loadProfiles, profiles, activeProfile, activeTab, setActiveTab } = useStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    loadProfiles();
    const timer = setTimeout(() => setShowSplash(false), 1600);
    return () => clearTimeout(timer);
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

  const splash = showSplash && (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--ui-bg)' }}>
      <img src="/app_icon.png" alt="MorphIQ" style={{ width: 96, height: 96, borderRadius: 28, objectFit: 'cover' }} />
      <h1 style={{ fontFamily: 'var(--ui-font)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>MorphIQ</h1>
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ui-text-secondary)' }}>Body Intelligence</span>
    </div>
  );

  if (profiles.length === 0) {
    return (<>{splash}<OnboardingScreen /></>);
  }

  return (
    <>
      {splash}
      <main style={{ flex: 1 }}>
        {activeTab === 'home' && <HomeScreen onOpenSettings={() => setActiveTab('settings')} />}
        {activeTab === 'gym' && <ComingSoonScreen title="Gym" description="Gym hub — arriving in Slice 3" icon={<Dumbbell size={26} />} />}
        {activeTab === 'exercises' && <ComingSoonScreen title="Exercises" description="Exercise library — arriving in Slice 2" icon={<LibraryBig size={26} />} />}
        {activeTab === 'coach' && <ComingSoonScreen title="Coach" description="AI coach — arriving in Slice 4" icon={<Sparkles size={26} />} />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>
      <BottomNav items={[...NAV_ITEMS]} activeId={activeTab} onSelect={id => setActiveTab(id as TabId)} />
    </>
  );
}

export default App;
