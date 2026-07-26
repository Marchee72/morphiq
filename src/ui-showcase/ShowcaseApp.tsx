import React, { useState } from 'react';
import type { ThemeId, ScreenId, ActiveExercise, ExerciseItem } from './types';
import { THEME_CONFIGS, INITIAL_ACTIVE_SESSION } from './mockData';
import { MainScreen } from './screens/MainScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { GymSessionScreen } from './screens/GymSessionScreen';
import { CoachScreen } from './screens/CoachScreen';
import { AddExerciseModal } from './screens/AddExerciseModal';
import { LayoutDashboard, Dumbbell, LibraryBig, Sparkles, Smartphone, Grid, Eye, X } from 'lucide-react';
import './showcase.css';

export const ShowcaseApp: React.FC = () => {
  const [activeTheme, setActiveTheme] = useState<ThemeId>('clay-indigo');
  const [activeScreen, setActiveScreen] = useState<ScreenId>('main');
  const [viewMode, setViewMode] = useState<'mobile' | 'fullscreen' | 'grid'>('mobile');
  const [showSampleImageModal, setShowSampleImageModal] = useState(false);

  const [activeExercises, setActiveExercises] = useState<ActiveExercise[]>(INITIAL_ACTIVE_SESSION);

  const handleToggleSet = (exerciseId: string, setId: string) => {
    setActiveExercises(prev =>
      prev.map(ex => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map(s => (s.id === setId ? { ...s, completed: !s.completed } : s)),
        };
      })
    );
  };

  const handleAddSet = (exerciseId: string) => {
    setActiveExercises(prev =>
      prev.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const nextSetNum = ex.sets.length + 1;
        const lastWeight = ex.sets[ex.sets.length - 1]?.weightKg || 50;
        return {
          ...ex,
          sets: [
            ...ex.sets,
            { id: `s_${Date.now()}`, setNum: nextSetNum, weightKg: lastWeight, reps: 10, completed: false },
          ],
        };
      })
    );
  };

  const handleAddExerciseToSession = (ex: ExerciseItem) => {
    const newEx: ActiveExercise = {
      id: `act_${Date.now()}`,
      name: ex.name,
      muscle: ex.muscle,
      sets: [
        { id: `s_${Date.now()}_1`, setNum: 1, weightKg: 40, reps: 10, completed: false },
        { id: `s_${Date.now()}_2`, setNum: 2, weightKg: 40, reps: 10, completed: false },
      ],
    };
    setActiveExercises(prev => [...prev, newEx]);
  };

  const currentThemeConfig = THEME_CONFIGS.find(t => t.id === activeTheme) || THEME_CONFIGS[0];

  const handleOpenSampleModal = () => setShowSampleImageModal(true);
  const handleCloseSampleModal = () => setShowSampleImageModal(false);

  const handleNavMain = () => setActiveScreen('main');
  const handleNavExercises = () => setActiveScreen('exercises');
  const handleNavGym = () => setActiveScreen('gym');
  const handleNavCoach = () => setActiveScreen('coach');
  const handleNavAdd = () => setActiveScreen('add_exercise');

  const handleModeMobile = () => setViewMode('mobile');
  const handleModeGrid = () => setViewMode('grid');

  const renderScreen = (screen: ScreenId, theme: ThemeId) => {
    switch (screen) {
      case 'main':
        return <MainScreen themeId={theme} onNavigate={s => setActiveScreen(s)} />;
      case 'exercises':
        return (
          <ExercisesScreen
            themeId={theme}
            onSelectExercise={handleNavAdd}
            onAddExerciseClick={handleNavAdd}
          />
        );
      case 'gym':
        return (
          <GymSessionScreen
            themeId={theme}
            activeExercises={activeExercises}
            onToggleSet={handleToggleSet}
            onAddSet={handleAddSet}
            onOpenAddExercise={handleNavAdd}
            onFinishSession={handleNavMain}
          />
        );
      case 'coach':
        return <CoachScreen themeId={theme} />;
      case 'add_exercise':
        return (
          <AddExerciseModal
            themeId={theme}
            onAddExerciseToSession={handleAddExerciseToSession}
            onClose={handleNavGym}
          />
        );
      default:
        return <MainScreen themeId={theme} onNavigate={s => setActiveScreen(s)} />;
    }
  };

  const isMobileView = viewMode === 'mobile';
  const isGridView = viewMode === 'grid';

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  };

  const modalContainerStyle: React.CSSProperties = {
    background: '#181b22',
    borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '24px',
    maxWidth: '650px',
    maxHeight: '90vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  };

  return (
    <div className="showcase-root">
      <header className="showcase-header">
        <div className="showcase-header-top">
          <div className="showcase-brand">
            <span className="showcase-logo-badge">MorphIQ UI</span>
            <div>
              <h1 className="showcase-title">Mobile UI Design Suite & Interactive Showcase</h1>
              <span className="showcase-subtitle">Compare 6 unique mobile design styles across 5 app screens</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleOpenSampleModal}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                padding: '6px 12px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Eye size={14} /> View Reference Sample
            </button>

            <div style={{ background: 'rgba(0,0,0,0.5)', padding: '3px', borderRadius: '10px', display: 'flex', gap: '2px' }}>
              <button
                onClick={handleModeMobile}
                style={{
                  background: isMobileView ? 'white' : 'transparent',
                  color: isMobileView ? 'black' : '#94a3b8',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Smartphone size={14} /> Phone Frame
              </button>
              <button
                onClick={handleModeGrid}
                style={{
                  background: isGridView ? 'white' : 'transparent',
                  color: isGridView ? 'black' : '#94a3b8',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Grid size={14} /> Side-by-Side
              </button>
            </div>
          </div>
        </div>

        <div className="theme-selector-grid">
          {THEME_CONFIGS.map(t => (
            <button
              key={t.id}
              className={`theme-pill-btn ${activeTheme === t.id ? 'active' : ''}`}
              onClick={() => setActiveTheme(t.id)}
            >
              <span className="theme-dot" style={{ backgroundColor: t.accent }} />
              {t.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="screen-selector-bar">
            <button
              className={`screen-tab-btn ${activeScreen === 'main' ? 'active' : ''}`}
              onClick={handleNavMain}
            >
              1. Main Dashboard
            </button>
            <button
              className={`screen-tab-btn ${activeScreen === 'exercises' ? 'active' : ''}`}
              onClick={handleNavExercises}
            >
              2. Exercises
            </button>
            <button
              className={`screen-tab-btn ${activeScreen === 'gym' ? 'active' : ''}`}
              onClick={handleNavGym}
            >
              3. Gym Session
            </button>
            <button
              className={`screen-tab-btn ${activeScreen === 'coach' ? 'active' : ''}`}
              onClick={handleNavCoach}
            >
              4. Coach AI
            </button>
            <button
              className={`screen-tab-btn ${activeScreen === 'add_exercise' ? 'active' : ''}`}
              onClick={handleNavAdd}
            >
              5. Add Exercise to Session
            </button>
          </div>
        </div>
      </header>

      <main className="showcase-body">
        <div style={{ textAlign: 'center', marginBottom: '20px', maxWidth: '600px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: currentThemeConfig.accent, textTransform: 'uppercase', letterSpacing: '1px' }}>
            {currentThemeConfig.subtitle}
          </span>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            {currentThemeConfig.tagline}
          </p>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0', fontStyle: 'italic', maxWidth: '500px' }}>
            Layout: {currentThemeConfig.structuralPrinciple}
          </p>
        </div>

        {isMobileView && (
          <div className="mobile-frame-container">
            <div className="mobile-frame-notch">
              <div className="mobile-frame-camera" />
            </div>

            <div className={`mobile-screen-content theme-${activeTheme}`}>
              <div className="mobile-status-bar">
                <span>9:41</span>
                <span style={{ fontSize: '10px' }}>📶 5G 🔋 98%</span>
              </div>

              {renderScreen(activeScreen, activeTheme)}

              {activeScreen !== 'add_exercise' && (
                <div className="mobile-bottom-nav">
                  <button
                    className={`mobile-nav-item ${activeScreen === 'main' ? 'active' : ''}`}
                    onClick={handleNavMain}
                  >
                    <LayoutDashboard size={18} />
                    <span>Main</span>
                  </button>
                  <button
                    className={`mobile-nav-item ${activeScreen === 'exercises' ? 'active' : ''}`}
                    onClick={handleNavExercises}
                  >
                    <LibraryBig size={18} />
                    <span>Exercises</span>
                  </button>
                  <button
                    className={`mobile-nav-item ${activeScreen === 'gym' ? 'active' : ''}`}
                    onClick={handleNavGym}
                  >
                    <Dumbbell size={18} />
                    <span>Gym</span>
                  </button>
                  <button
                    className={`mobile-nav-item ${activeScreen === 'coach' ? 'active' : ''}`}
                    onClick={handleNavCoach}
                  >
                    <Sparkles size={18} />
                    <span>Coach</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {isGridView && (
          <div className="comparison-grid">
            {THEME_CONFIGS.map(t => (
              <div key={t.id} className="comparison-card">
                <div className="comparison-card-header">
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px', color: 'white' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{t.subtitle}</div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTheme(t.id);
                      setViewMode('mobile');
                    }}
                    style={{ background: 'white', color: 'black', border: 'none', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Select
                  </button>
                </div>
                <div className={`theme-${t.id}`} style={{ height: '620px', overflowY: 'auto' }}>
                  {renderScreen(activeScreen, t.id)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showSampleImageModal && (
        <div 
          style={modalOverlayStyle}
          onClick={handleCloseSampleModal}
        >
          <div 
            style={modalContainerStyle}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Reference Sample Image</h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{currentThemeConfig.name}</span>
              </div>
              <button 
                onClick={handleCloseSampleModal}
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <img 
              src={`/ui-examples/${currentThemeConfig.sampleImage}`}
              alt={currentThemeConfig.name}
              style={{ width: '100%', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
