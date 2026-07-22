import React, { useMemo, useState, useEffect } from 'react';
import { Dumbbell, Trophy, Play, Calendar, Settings, BookOpen, Trash2 } from 'lucide-react';
import { AppBar } from '../../ui/primitives/AppBar';
import { GymEquipmentSheet } from '../settings/GymEquipmentSheet';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';
import { Chip } from '../../ui/primitives/Chip';
import { WorkoutHistoryCard } from './WorkoutHistoryCard';
import { LiveWorkoutScreen } from './LiveWorkoutScreen';
import { useStore } from '../../presentation/state/store';

type HistoryFilter = '7d' | '30d' | 'all';

const FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'all', label: 'All' },
];

function fmtDMY(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const GymScreen: React.FC = () => {
  const {
    workoutHistory,
    activeWorkoutSets,
    deleteWorkoutLog,
    activeSession,
    isGymModeOpen,
    setIsGymModeOpen,
    startActiveSession,
    savedRoutines,
    startActiveSessionWithRoutine,
    deleteRoutineTemplate,
  } = useStore();

  const [filter, setFilter] = useState<HistoryFilter>('7d');
  const [dateQuery, setDateQuery] = useState('');
  const [isEquipmentOpen, setIsEquipmentOpen] = useState(false);
  const [showAllPrs, setShowAllPrs] = useState(false);
  const { activeProfile, updateProfile } = useStore();


  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [activeSeconds, setActiveSeconds] = useState(0);

  useEffect(() => {
    if (!activeSession) return;
    const updateSecs = () => {
      const elapsed = Math.floor((new Date().getTime() - new Date(activeSession.startTime).getTime()) / 1000);
      setActiveSeconds(Math.max(0, elapsed));
    };
    updateSecs();
    const interval = setInterval(updateSecs, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const activeSessionStats = useMemo(() => {
    if (!activeSession) return null;
    const totalVolume = activeSession.sets.reduce((sum, s) => sum + ((s.weight || 0) * (s.reps || 0)), 0);
    const exMap = new Map<string, number>();
    activeSession.sets.forEach(s => {
      const name = s.exerciseName || 'Ejercicio';
      exMap.set(name, (exMap.get(name) || 0) + 1);
    });
    const exerciseSummary = Array.from(exMap.entries()).map(([name, count]) => ({ name, count }));
    return { totalVolume, exerciseSummary };
  }, [activeSession]);

  const formatTimer = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Compute Weekly Stats
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - 7);

    const recent = workoutHistory.filter(w => new Date(w.timestamp) >= startOfWeek);
    const totalDuration = recent.reduce((sum, w) => sum + (w.duration || 0), 0);
    const totalCalories = recent.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);

    return {
      count: recent.length,
      totalDuration,
      totalCalories,
    };
  }, [workoutHistory]);

  // Compute Personal Bests (PRs) per exercise
  const personalBests = useMemo(() => {
    const pbs: Record<string, { maxWeight: number; maxReps: number }> = {};

    Object.values(activeWorkoutSets).forEach(sets => {
      sets.forEach(s => {
        if (!s.exerciseName || s.weight == null) return;
        const name = s.exerciseName.toLowerCase();
        if (!pbs[name] || s.weight > pbs[name].maxWeight) {
          pbs[name] = { maxWeight: s.weight, maxReps: s.reps || 0 };
        }
      });
    });

    return Object.entries(pbs).map(([name, pb]) => ({
      name,
      maxWeight: pb.maxWeight,
      maxReps: pb.maxReps,
    }));
  }, [activeWorkoutSets]);

  const displayedPrs = useMemo(() => {
    return showAllPrs ? personalBests : personalBests.slice(0, 4);
  }, [showAllPrs, personalBests]);

  // Filtered history based on selected filter + date search
  const filteredHistory = useMemo(() => {
    let list = workoutHistory;

    if (filter === '7d') {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      list = list.filter(w => new Date(w.timestamp) >= since);
    } else if (filter === '30d') {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      list = list.filter(w => new Date(w.timestamp) >= since);
    }

    if (dateQuery.trim()) {
      // Accept dd/mm/yyyy or dd-mm-yyyy or partial
      const q = dateQuery.trim().toLowerCase();
      // Try exact date match
      const m = q.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
      if (m) {
        const [, d, mo, y] = m;
        let year = parseInt(y, 10);
        if (year < 100) year += 2000;
        const target = new Date(year, parseInt(mo, 10) - 1, parseInt(d, 10));
        list = list.filter(w => sameDay(new Date(w.timestamp), target));
      } else {
        // Partial: match against formatted dd/mm/yyyy string
        list = list.filter(w => fmtDMY(new Date(w.timestamp)).toLowerCase().includes(q));
      }
    }

    return [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [workoutHistory, filter, dateQuery]);

  return (
    <>
      <AppBar
        title="Gym"
        overline="Workout Hub & Tracking"
        actions={
          <button
            type="button"
            className="ui-icon-btn"
            onClick={() => setIsEquipmentOpen(true)}
            aria-label="Configurar equipamiento"
            title="Equipamiento"
          >
            <Settings size={20} />
          </button>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px 120px' }}>
        {/* Active Session / Start Session Hero Card — One UI 9 Premium design */}
        <Card style={activeSession ? { border: '1px solid var(--ui-outline-strong)', boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)' } : undefined}>
          {activeSession ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Header Badge & Timer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '3px 10px',
                  borderRadius: 'var(--ui-radius-pill)',
                  background: 'var(--ui-success-bg)',
                  color: 'var(--ui-success)',
                }}>
                  <span className="ui-live-dot" />
                  Sesión en progreso
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: 'var(--ui-primary)' }}>
                  ⏱ {formatTimer(activeSeconds)}
                </span>
              </div>

              {/* Title & Stats */}
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', margin: 0, color: 'var(--ui-text-primary)' }}>
                  {activeSession.workoutType || 'Strength Training'}
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>
                    🏋️ {activeSession.sets.length} series registradas
                  </span>
                  {activeSessionStats && activeSessionStats.totalVolume > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>
                      💪 {activeSessionStats.totalVolume.toLocaleString()} kg volumen
                    </span>
                  )}
                </div>
              </div>

              {/* Logged Exercise Chips */}
              {activeSessionStats && activeSessionStats.exerciseSummary.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                  {activeSessionStats.exerciseSummary.map(ex => (
                    <span
                      key={ex.name}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 'var(--ui-radius-pill)',
                        background: 'var(--ui-surface-variant)',
                        color: 'var(--ui-text-primary)',
                      }}
                    >
                      {ex.name} ({ex.count} sets)
                    </span>
                  ))}
                </div>
              )}

              {/* Resume Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
                <Button
                  variant="filled"
                  onClick={() => setIsGymModeOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Play size={18} fill="currentColor" /> Abrir Tracker en Vivo
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '3px 10px',
                    borderRadius: 'var(--ui-radius-pill)',
                    background: 'var(--ui-tonal)',
                    color: 'var(--ui-on-tonal)',
                  }}>
                    Live Workout Tracker
                  </span>
                  <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', margin: '8px 0 0 0', color: 'var(--ui-text-primary)' }}>
                    ¿Listo para entrenar?
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--ui-text-secondary)', margin: '4px 0 0 0' }}>
                    Registra series, repeticiones, peso y notas en tiempo real con temporizador automático.
                  </p>
                </div>

                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  background: 'var(--ui-tonal)',
                  color: 'var(--ui-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Dumbbell size={22} />
                </div>
              </div>

              {/* Quick Launch Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                <Button
                  variant="filled"
                  size="sm"
                  onClick={() => startActiveSession('Entrenamiento de Fuerza')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Play size={14} fill="currentColor" /> Fuerza
                </Button>
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => startActiveSession('HIIT / Cardio')}
                >
                  ⚡ HIIT / Cardio
                </Button>
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => startActiveSession('Calistenia')}
                >
                  🤸 Calistenia
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Saved Routines Section */}
        {savedRoutines.length > 0 && (

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={15} style={{ color: 'var(--ui-primary)' }} /> Rutinas Guardadas ({savedRoutines.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {savedRoutines.map(routine => (
                <Card key={routine.id} style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--ui-text-primary)' }}>
                        {routine.title}
                      </h4>
                      <p style={{ fontSize: 12, color: 'var(--ui-text-secondary)', margin: '2px 0 0 0' }}>
                        🏋️ {routine.exercises.length} ejercicios {routine.description ? `• ${routine.description}` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label="Eliminar rutina guardada"
                      onClick={() => routine.id && deleteRoutineTemplate(routine.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--ui-error)', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {routine.targetMuscles?.map((muscle, idx) => (
                        <span key={idx} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--ui-radius-pill)', background: 'var(--ui-tonal)', color: 'var(--ui-on-tonal)' }}>
                          {muscle}
                        </span>
                      ))}
                    </div>

                    <Button
                      variant="filled"
                      size="sm"
                      onClick={() => startActiveSessionWithRoutine(routine)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}
                    >
                      <Play size={14} fill="currentColor" /> Iniciar Rutina
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Stats Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>

          <Card style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ui-primary)' }}>{weeklyStats.count}</div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', marginTop: 2 }}>
              Workouts (7d)
            </div>
          </Card>

          <Card style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ui-text-primary)' }}>{weeklyStats.totalDuration}m</div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', marginTop: 2 }}>
              Duration
            </div>
          </Card>

          <Card style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ui-error)' }}>{weeklyStats.totalCalories}</div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ui-text-secondary)', marginTop: 2 }}>
              Burn (kcal)
            </div>
          </Card>
        </div>

        {/* Personal Best Records (PRs) — Grid view (no horizontal scroll) */}
        {personalBests.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trophy size={15} style={{ color: 'gold' }} /> Récords Personales ({personalBests.length})
              </div>
              {personalBests.length > 4 && (
                <Button
                  variant="tonal"
                  size="sm"
                  onClick={() => setShowAllPrs(prev => !prev)}
                  style={{ fontSize: 12, padding: '2px 8px' }}
                >
                  {showAllPrs ? 'Mostrar menos' : `Ver todos (${personalBests.length})`}
                </Button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {displayedPrs.map(pb => (
                <Card key={pb.name} style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', color: 'var(--ui-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pb.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--ui-primary)' }}>
                      {pb.maxWeight} <span style={{ fontSize: 12, fontWeight: 700 }}>kg</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>
                      × {pb.maxReps} reps
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Workout History with filter + date search */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', marginBottom: 8 }}>
            Workout History ({filteredHistory.length})
          </div>

          {/* Filter chips (wrapped, no horizontal scroll) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {FILTERS.map(f => (
              <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
            ))}
          </div>

          {/* Date search input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--ui-surface)',
            border: '1px solid var(--ui-outline)',
            padding: '10px 14px',
            borderRadius: 'var(--ui-radius-md)',
            marginBottom: 12,
          }}>
            <Calendar size={16} style={{ color: 'var(--ui-text-secondary)' }} />
            <input
              type="text"
              value={dateQuery}
              onChange={e => setDateQuery(e.target.value)}
              placeholder="Search by date (dd/mm/yyyy)"
              aria-label="Search workouts by date"
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ui-text-primary)',
                fontFamily: 'var(--ui-font)',
              }}
            />
            {dateQuery && (
              <button
                type="button"
                aria-label="Clear date search"
                onClick={() => setDateQuery('')}
                style={{ background: 'none', border: 'none', color: 'var(--ui-text-secondary)', cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            )}
          </div>

          {filteredHistory.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--ui-text-secondary)' }}>
              <Dumbbell size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                {dateQuery ? 'No workouts on that date' : 'No workouts in this period'}
              </p>
              <p style={{ fontSize: 12, margin: '4px 0 0 0' }}>
                {dateQuery ? 'Try a different date or clear the search.' : 'Tap "Start Session" to record your first workout.'}
              </p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredHistory.map(log => (
                <WorkoutHistoryCard
                  key={log.id}
                  log={log}
                  sets={log.id ? activeWorkoutSets[log.id] : []}
                  onDelete={deleteWorkoutLog}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Workout Tracker Full Screen */}
      <LiveWorkoutScreen
        isOpen={isGymModeOpen}
        onClose={() => setIsGymModeOpen(false)}
      />

      <GymEquipmentSheet
        open={isEquipmentOpen}
        onClose={() => setIsEquipmentOpen(false)}
        selected={activeProfile?.availableEquipment ?? []}
        onSave={async (equipment) => {
          if (activeProfile) {
            await updateProfile({ ...activeProfile, availableEquipment: equipment });
          }
        }}
      />
    </>
  );
};