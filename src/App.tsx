import { useEffect, useState } from 'react';
import { useStore } from './presentation/state/store';
import { ScaleConnector } from './presentation/components/ScaleConnector';
import { AnalyticsDashboard } from './presentation/components/AnalyticsDashboard';
import { DailyLog } from './presentation/components/DailyLog';
import { CoachChat } from './presentation/components/CoachChat';
import { ProfileSettings } from './presentation/components/ProfileSettings';
import { WorkoutTab } from './presentation/components/WorkoutTab';
import { GymTracker } from './presentation/components/GymTracker';
import { LayoutDashboard, Apple, Sparkles, Settings, Dumbbell } from 'lucide-react';
import { CapacitorHealthProvider } from './data/health/CapacitorHealthProvider';
import { WebHealthProvider } from './data/health/WebHealthProvider';

function App() {
  const { 
    loadProfiles, 
    activeProfile, 
    profiles, 
    setActiveProfile, 
    activeTab, 
    setActiveTab,
    activeWorkout,
    isGymModeOpen,
    setIsGymModeOpen
  } = useStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    loadProfiles();
    
    // Hide splash overlay after 2 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, [loadProfiles]);

  // Automatic sync from Samsung Health (via Health Connect) on launch
  useEffect(() => {
    if (!activeProfile) return;

    const autoSync = async () => {
      try {
        const provider = new CapacitorHealthProvider();
        const fallbackProvider = new WebHealthProvider();
        const healthProvider = provider.isAvailable() ? provider : fallbackProvider;

        const granted = await healthProvider.requestPermissions();
        if (granted) {
          const since = new Date();
          since.setDate(since.getDate() - 30);
          
          const workouts = await healthProvider.importWorkouts(since);
          if (healthProvider.importBodyComposition) {
            const measurements = await healthProvider.importBodyComposition(since, activeProfile);
            if (measurements.length > 0) {
              await useStore.getState().importMeasurements(measurements);
            }
          }
          await useStore.getState().importWorkouts(workouts);
          console.log("MorphIQ Launch Auto-Sync: Health synchronization completed successfully.");
        }
      } catch (err) {
        console.error("MorphIQ Launch Auto-Sync error:", err);
      }
    };

    autoSync();
  }, [activeProfile]);

  // If no profiles exist, force user to create one
  const hasNoProfiles = profiles.length === 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Splash Screen Overlay */}
      {showSplash && (
        <div 
          className="splash-screen animate-fadeOut"
          style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'var(--m3-sys-background)', 
            zIndex: 9999, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}
        >
          <div className="flex flex-col items-center gap-4 animate-scaleUp">
            <img 
              src="/app_icon.png" 
              alt="MorphIQ Logo" 
              className="rounded-3xl shadow-lg animate-pulse" 
              style={{ 
                width: '96px',
                height: '96px',
                boxShadow: '0 10px 30px rgba(129, 140, 248, 0.3)',
                objectFit: 'cover'
              }}
            />
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, color: 'var(--m3-sys-on-background)', marginTop: '16px', letterSpacing: '-0.02em', lineHeight: 1 }}>MorphIQ</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--m3-sys-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: 4 }}>Body Intelligence</span>
            <div style={{ width: 128, height: 4, backgroundColor: 'var(--m3-sys-surface-variant)', borderRadius: 9999, marginTop: 24, overflow: 'hidden', position: 'relative' }}>
              <div 
                className="animate-shimmer-sweep"
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', backgroundColor: 'var(--m3-sys-primary)', borderRadius: 9999 }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="main-header">
        <div className="w-full flex flex-row justify-between items-center gap-4 header-content">
          <div className="flex items-center gap-2 logo-wrap">
            <img 
              src="/app_icon.png" 
              alt="MorphIQ Logo" 
              className="rounded-xl shadow-md flex-shrink-0"
              style={{ 
                width: '36px',
                height: '36px',
                objectFit: 'cover' 
              }}
            />
            <div className="flex flex-col">
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--color-text-primary)', lineHeight: 1 }}>MorphIQ</h1>
              <span style={{ fontSize: '0.6rem', color: 'var(--accent-teal)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2 }}>Body Intelligence</span>
            </div>
          </div>

          {/* Profile Switcher */}
          {!hasNoProfiles && activeProfile && (
            <div className="flex items-center gap-2 profile-switcher-wrap flex-shrink-0">
              <select
                value={activeProfile.id}
                onChange={(e) => setActiveProfile(e.target.value)}
                className="bg-black/40 border border-white/5 text-xs font-semibold text-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:border-purple-500/50 transition cursor-pointer max-w-[130px]"
                style={{ minHeight: 48 }}
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={() => setActiveTab('settings')}
                className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition border border-white/5 flex items-center justify-center"
                style={{ width: 48, height: 48, minHeight: 48 }}
                title="Profile Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="main-content">
        {hasNoProfiles ? (
          <div className="max-w-xl w-full mx-auto my-12 flex flex-col gap-4">
            <div className="glass-panel p-6 text-center">
              <h2 className="text-2xl font-bold mb-2">Create Your First Profile</h2>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                MorphIQ requires a profile (height, age, gender) to compute your body composition metrics from raw scale readings.
              </p>
              <ProfileSettings />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="flex flex-col gap-6 w-full animate-fadeIn">
                <ScaleConnector />
                <AnalyticsDashboard />
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="w-full animate-fadeIn">
                <DailyLog />
              </div>
            )}

            {activeTab === 'workout' && (
              <div className="w-full animate-fadeIn">
                <WorkoutTab />
              </div>
            )}

            {activeTab === 'coach' && (
              <div className="w-full flex-1 flex flex-col animate-fadeIn">
                <CoachChat />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="w-full animate-fadeIn">
                <ProfileSettings />
              </div>
            )}
          </>
        )}

        {/* Footer inside scrollable main content */}
        <footer className="border-t border-white/5 pt-6 text-center text-xs text-color-text-muted mt-auto">
          <p>&copy; {new Date().getFullYear()} MorphIQ. Privacy-First Local Body Composition & Health Hub.</p>
        </footer>
      </main>

      {/* Floating Active Workout Banner (Sticky gym companion bar) */}
      {!hasNoProfiles && activeProfile && activeWorkout && !isGymModeOpen && (
        <div 
          onClick={() => setIsGymModeOpen(true)}
          className="active-workout-banner animate-scaleUp"
          style={{
            position: 'fixed',
            bottom: '96px', /* Just above bottom navigation (80px + margin) */
            left: '16px',
            right: '16px',
            backgroundColor: 'var(--m3-sys-secondary-container, #e8def8)',
            color: 'var(--m3-sys-on-secondary-container, #21005d)',
            borderRadius: 'var(--m3-shape-lg, 16px)',
            border: '1.5px solid var(--m3-sys-secondary)',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            zIndex: 90,
            boxShadow: 'var(--m3-elevation-2)'
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-secondary rounded-full text-on-secondary flex-shrink-0 animate-pulse flex items-center justify-center" style={{ width: '32px', height: '32px' }}>
              <Dumbbell className="w-4 h-4 text-on-secondary" />
            </div>
            <div className="min-w-0 text-left">
              <span className="text-[9px] uppercase font-black tracking-widest text-secondary block">
                Session In Progress
              </span>
              <span className="text-xs font-bold text-on-secondary-container truncate block">
                {activeWorkout.type}
              </span>
            </div>
          </div>
          <span 
            className="text-[10px] bg-secondary text-on-secondary px-3 py-1.5 rounded-full font-black uppercase tracking-wider hover:brightness-105 transition"
            style={{ minHeight: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            Resume Track
          </span>
        </div>
      )}

      {/* Full-Screen Gym Focus Mode Overlay */}
      {!hasNoProfiles && activeProfile && activeWorkout && isGymModeOpen && (
        <GymTracker />
      )}

      {/* M3 Bottom NavigationBar */}
      {!hasNoProfiles && activeProfile && (
        <div className="m3-navigation-bar">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`m3-navigation-bar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            title="Dashboard"
          >
            <div className="m3-navigation-bar-item-icon-wrapper">
              <LayoutDashboard />
            </div>
            <span className="m3-navigation-bar-item-label">Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`m3-navigation-bar-item ${activeTab === 'logs' ? 'active' : ''}`}
            title="Daily Logs"
          >
            <div className="m3-navigation-bar-item-icon-wrapper">
              <Apple />
            </div>
            <span className="m3-navigation-bar-item-label">Daily Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('workout')}
            className={`m3-navigation-bar-item ${activeTab === 'workout' ? 'active' : ''}`}
            title="Workouts"
          >
            <div className="m3-navigation-bar-item-icon-wrapper">
              <Dumbbell />
            </div>
            <span className="m3-navigation-bar-item-label">Workouts</span>
          </button>
          <button
            onClick={() => setActiveTab('coach')}
            className={`m3-navigation-bar-item ${activeTab === 'coach' ? 'active' : ''}`}
            title="AI Coach"
          >
            <div className="m3-navigation-bar-item-icon-wrapper">
              <Sparkles />
            </div>
            <span className="m3-navigation-bar-item-label">AI Coach</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`m3-navigation-bar-item ${activeTab === 'settings' ? 'active' : ''}`}
            title="Settings"
          >
            <div className="m3-navigation-bar-item-icon-wrapper">
              <Settings />
            </div>
            <span className="m3-navigation-bar-item-label">Settings</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
