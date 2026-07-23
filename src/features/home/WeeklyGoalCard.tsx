import React from 'react';
import { Card } from '../../ui/primitives/Card';
import { Trophy, Flame, Clock, Check } from 'lucide-react';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';

export interface WeeklyGoalCardProps {
  workoutLogs: WorkoutLog[];
  weeklyGoalDays?: number;
  targetActiveMins?: number;
  targetCalories?: number;
}

export const WeeklyGoalCard: React.FC<WeeklyGoalCardProps> = ({
  workoutLogs,
  weeklyGoalDays = 4,
  targetActiveMins = 300,
  targetCalories = 3500,
}) => {
  const now = new Date();
  const currentDayIdx = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6

  // Get Monday of current week
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  // Map 7 days of current week
  const daysMap = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    const dayName = ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i];
    
    // Find workouts on this date
    const dayWorkouts = workoutLogs.filter(w => {
      const wd = new Date(w.timestamp);
      return wd.getFullYear() === d.getFullYear() &&
        wd.getMonth() === d.getMonth() &&
        wd.getDate() === d.getDate();
    });

    return {
      dayName,
      isToday: i === currentDayIdx,
      hasWorkout: dayWorkouts.length > 0,
    };
  });

  // Calculate totals for current week
  const thisWeekWorkouts = workoutLogs.filter(w => new Date(w.timestamp) >= startOfWeek);
  const workoutDaysCount = daysMap.filter(d => d.hasWorkout).length;
  const totalMins = thisWeekWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
  const totalCals = thisWeekWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);

  const minsPct = Math.min(100, Math.round((totalMins / targetActiveMins) * 100));
  const calsPct = Math.min(100, Math.round((totalCals / targetCalories) * 100));

  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--ui-radius-pill)',
            background: 'rgba(3, 129, 254, 0.12)',
            color: 'var(--ui-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Trophy size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>
              Weekly Target
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ui-text-primary)', letterSpacing: '-0.3px' }}>
              {workoutDaysCount} of {weeklyGoalDays} workout days
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 800,
          padding: '4px 10px',
          borderRadius: 'var(--ui-radius-pill)',
          background: workoutDaysCount >= weeklyGoalDays ? 'var(--ui-success-bg)' : 'var(--ui-tonal)',
          color: workoutDaysCount >= weeklyGoalDays ? 'var(--ui-success)' : 'var(--ui-text-secondary)',
        }}>
          {workoutDaysCount >= weeklyGoalDays ? 'Goal Met 🎉' : `${weeklyGoalDays - workoutDaysCount} left`}
        </span>
      </div>

      {/* 7-Day Pills Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 16 }}>
        {daysMap.map((d, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 0',
              borderRadius: 14,
              background: d.hasWorkout
                ? 'var(--ui-primary)'
                : d.isToday
                ? 'var(--ui-surface-dim)'
                : 'var(--ui-tonal)',
              color: d.hasWorkout ? 'var(--ui-on-primary)' : 'var(--ui-text-secondary)',
              border: d.isToday && !d.hasWorkout ? '1px solid var(--ui-outline-strong)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{d.dayName}</span>
            <div style={{
              width: 18,
              height: 18,
              borderRadius: 'var(--ui-radius-pill)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: d.hasWorkout ? 'rgba(255,255,255,0.25)' : 'transparent',
            }}>
              {d.hasWorkout ? <Check size={12} strokeWidth={3} /> : <div style={{ width: 4, height: 4, borderRadius: 999, background: 'currentColor', opacity: 0.4 }} />}
            </div>
          </div>
        ))}
      </div>

      {/* Progress Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Active Minutes */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            <span style={{ color: 'var(--ui-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={14} /> Active Time
            </span>
            <span style={{ color: 'var(--ui-text-primary)' }}>{totalMins} / {targetActiveMins} mins</span>
          </div>
          <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--ui-tonal)', overflow: 'hidden' }}>
            <div style={{ width: `${minsPct}%`, height: '100%', borderRadius: 999, background: 'var(--ui-primary)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Active Calories */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            <span style={{ color: 'var(--ui-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Flame size={14} /> Active Calories
            </span>
            <span style={{ color: 'var(--ui-text-primary)' }}>{totalCals} / {targetCalories} kcal</span>
          </div>
          <div style={{ width: '100%', height: 6, borderRadius: 999, background: 'var(--ui-tonal)', overflow: 'hidden' }}>
            <div style={{ width: `${calsPct}%`, height: '100%', borderRadius: 999, background: '#FF6B00', transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>
    </Card>
  );
};
