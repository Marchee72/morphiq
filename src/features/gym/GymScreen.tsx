import React, { useMemo, useState } from 'react';
import { Dumbbell, Trophy, Play, Calendar } from 'lucide-react';
import { AppBar } from '../../ui/primitives/AppBar';
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
  const { workoutHistory, activeWorkoutSets, deleteWorkoutLog, activeSession, isGymModeOpen, setIsGymModeOpen, startActiveSession } = useStore();

  const [filter, setFilter] = useState<HistoryFilter>('7d');
  const [dateQuery, setDateQuery] = useState('');

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
      <AppBar title="Gym" overline="Workout Hub & Tracking" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px 120px' }}>
        {/* Active Session / Start Session Hero Card — flat tonal surface, One UI */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <span style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '3px 10px',
                borderRadius: 'var(--ui-radius-pill)',
                background: activeSession ? 'var(--ui-success-bg)' : 'var(--ui-tonal)',
                color: activeSession ? 'var(--ui-success)' : 'var(--ui-on-tonal)',
              }}>
                {activeSession ? 'In progress' : 'Live Workout Tracker'}
              </span>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', margin: '8px 0 0 0', color: 'var(--ui-text-primary)' }}>
                {activeSession ? `${activeSession.workoutType}` : 'Ready to train?'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ui-text-secondary)', margin: '4px 0 0 0' }}>
                {activeSession ? `${activeSession.sets.length} sets logged in current session` : 'Track sets, reps, and exercise notes in real-time.'}
              </p>
            </div>

            <Button
              variant={activeSession ? 'tonal' : 'filled'}
              onClick={() => {
                if (activeSession) {
                  setIsGymModeOpen(true);
                } else {
                  startActiveSession('Strength Training');
                }
              }}
              style={{ flexShrink: 0 }}
            >
              <Play size={18} fill="currentColor" /> {activeSession ? 'Resume' : 'Start Session'}
            </Button>
          </div>
        </Card>

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

        {/* Personal Best Records (PRs) */}
        {personalBests.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={15} style={{ color: 'gold' }} /> Personal Records ({personalBests.length})
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {personalBests.map(pb => (
                <Card key={pb.name} style={{ padding: '10px 14px', minWidth: 140, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pb.name}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ui-primary)', marginTop: 4 }}>
                    {pb.maxWeight} kg <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>× {pb.maxReps}</span>
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
    </>
  );
};