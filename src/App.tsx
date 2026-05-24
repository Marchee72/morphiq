import { useEffect, useState } from 'react';
import { useStore } from './presentation/state/store';
import { ScaleConnector } from './presentation/components/ScaleConnector';
import { AnalyticsDashboard } from './presentation/components/AnalyticsDashboard';
import { DailyLog } from './presentation/components/DailyLog';
import { CoachChat } from './presentation/components/CoachChat';
import { ProfileSettings } from './presentation/components/ProfileSettings';
import { LayoutDashboard, Apple, Sparkles, Settings, Activity } from 'lucide-react';

function App() {
  const { loadProfiles, activeProfile, profiles } = useStore();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'coach' | 'settings'>('dashboard');

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // If no profiles exist, force user to create one
  const hasNoProfiles = profiles.length === 0;

  return (
    <div className="flex-1 flex flex-col">
      {/* Top Navigation Header */}
      <header className="border-b border-white/5 bg-white/2 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-500 to-teal-400 rounded-xl shadow-lg shadow-purple-500/20">
              <Activity className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white leading-none">MorphIQ</h1>
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest mt-1 block">Body Intelligence</span>
            </div>
          </div>

          {!hasNoProfiles && activeProfile && (
            <nav className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'dashboard' ? 'bg-purple-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden md:inline">Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'logs' ? 'bg-purple-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Apple className="w-4 h-4" />
                <span className="hidden md:inline">Daily Logs</span>
              </button>
              <button
                onClick={() => setActiveTab('coach')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'coach' ? 'bg-purple-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden md:inline">AI Coach</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'settings' ? 'bg-purple-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden md:inline">Settings</span>
              </button>
            </nav>
          )}

          {!hasNoProfiles && activeProfile && (
            <div className="hidden lg:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
              <div className="w-2.5 h-2.5 bg-teal-400 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-gray-300">Active Profile: {activeProfile.name}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-1">
                  <ScaleConnector />
                </div>
                <div className="lg:col-span-2">
                  <AnalyticsDashboard />
                </div>
              </div>
            )}

            {activeTab === 'logs' && <DailyLog />}

            {activeTab === 'coach' && (
              <div className="max-w-4xl w-full mx-auto flex-1">
                <CoachChat />
              </div>
            )}

            {activeTab === 'settings' && <ProfileSettings />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 px-6 text-center text-xs text-color-text-muted">
        <p>&copy; {new Date().getFullYear()} MorphIQ. Privacy-First Local Body Composition & Health Hub.</p>
      </footer>
    </div>
  );
}

export default App;
