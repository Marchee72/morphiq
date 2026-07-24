import React, { useState, useMemo, useEffect } from 'react';
import { Settings, Activity, Flame, Beef, Dumbbell, CalendarCheck, UtensilsCrossed, Scale, Trophy } from 'lucide-react';
import { useStore } from '../../presentation/state/store';
import { AppBar } from '../../ui/primitives/AppBar';
import { MetricTile } from '../../ui/primitives/MetricTile';
import { CategoryToolbar } from '../../ui/primitives/CategoryToolbar';
import { MetricHeroCard } from './MetricHeroCard';
import { FoodTodayCard } from './FoodTodayCard';
import { TrendCard } from './TrendCard';
import { SyncCard } from './SyncCard';
import { StepGoalCard } from './StepGoalCard';
import { EnergyScore } from './EnergyScore';
import { WeeklyGoalCard } from './WeeklyGoalCard';
import { SleepRecoveryCard } from './SleepRecoveryCard';
import { BodyGoalProgressCard } from './BodyGoalProgressCard';
import { AddFoodSheet } from './AddFoodSheet';
import { LogWeightSheet } from './LogWeightSheet';
import { ActiveWorkoutBanner } from './ActiveWorkoutBanner';
import { CapacitorHealthProvider } from '../../data/health/CapacitorHealthProvider';
import { WebHealthProvider } from '../../data/health/WebHealthProvider';

type Category = 'activity' | 'nutrition' | 'body' | 'goals';

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayDMY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const CATEGORY_TABS = [
  { id: 'activity' as const, label: 'Activity', icon: <Activity size={15} /> },
  { id: 'nutrition' as const, label: 'Nutrition', icon: <UtensilsCrossed size={15} /> },
  { id: 'body' as const, label: 'Body', icon: <Scale size={15} /> },
  { id: 'goals' as const, label: 'Goals', icon: <Trophy size={15} /> },
];

export interface HomeScreenProps {
  onOpenSettings: () => void;
  onOpenFoodSheet?: () => void;
  onOpenWeightSheet?: () => void;
  quickAddButton?: React.ReactNode;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenSettings,
  onOpenFoodSheet,
  onOpenWeightSheet,
  quickAddButton,
}) => {
  const { activeProfile, measurements, foodLogs, workoutHistory, addFoodLog, deleteFoodLog, addManualMeasurement, importMeasurements } = useStore();
  const [category, setCategory] = useState<Category>('activity');
  const [foodOpen, setFoodOpen] = useState(false);
  const [wtOpen, setWtOpen] = useState(false);
  const [syncSt, setSyncSt] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState<string>();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const openFood = onOpenFoodSheet || (() => setFoodOpen(true));
  const openWeight = onOpenWeightSheet || (() => setWtOpen(true));

  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const prev = measurements.length > 1 ? measurements[measurements.length - 2] : null;
  const delta = latest && prev ? Number((latest.weight - prev.weight).toFixed(2)) : null;
  const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const trend = measurements.slice(-7).map(m => ({ label: fmtDate(new Date(m.timestamp)), weight: m.weight }));

  // Food aggregates
  const totalKcal = foodLogs.reduce((s, l) => s + l.calories, 0);
  const totalProtein = foodLogs.reduce((s, l) => s + l.protein, 0);

  const lastSevenDaysWorkoutsCount = useMemo(() => {
    const cut = new Date();
    cut.setDate(cut.getDate() - 7);
    return workoutHistory.filter(w => new Date(w.timestamp) >= cut).length;
  }, [workoutHistory]);

  // Gym week indicator
  const gymWeek = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - 7);
    const dayKeys = new Set<string>();
    for (const w of workoutHistory) {
      if (new Date(w.timestamp) >= since) {
        const d = new Date(w.timestamp);
        dayKeys.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }
    const daysThisWeek = dayKeys.size;
    const since28 = new Date(); since28.setDate(since28.getDate() - 28);
    const dayKeys28 = new Set<string>();
    for (const w of workoutHistory) {
      if (new Date(w.timestamp) >= since28) {
        const d = new Date(w.timestamp);
        dayKeys28.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      }
    }
    const avgPerWeek = Math.round((dayKeys28.size / 4) * 10) / 10;
    return { daysThisWeek, avgPerWeek };
  }, [workoutHistory]);

  // AI Energy Score (0-100): weighted blend of gym consistency, nutrition, and body trend
  const energyScore = useMemo(() => {
    let score = 50; // baseline
    // Gym consistency (0-30): 3+ days/week = full
    score += Math.min(30, gymWeek.avgPerWeek * 10);
    // Nutrition (0-20): logged food today
    if (totalKcal > 0) score += Math.min(20, totalKcal / 100);
    // Body trend (0-15): has recent measurement
    if (latest) score += 15;
    // Protein intake (0-15): 100g+ = full
    score += Math.min(15, totalProtein / 7);
    return Math.min(100, Math.max(0, Math.round(score)));
  }, [gymWeek.avgPerWeek, totalKcal, totalProtein, latest]);

  const energyBreakdown = [
    { label: 'Gym consistency', value: Math.min(30, gymWeek.avgPerWeek * 10), weight: 30 },
    { label: 'Nutrition', value: totalKcal > 0 ? Math.min(20, totalKcal / 100) : 0, weight: 20 },
    { label: 'Body data', value: latest ? 15 : 0, weight: 15 },
    { label: 'Protein', value: Math.min(15, totalProtein / 7), weight: 15 },
  ];

  const sync = async () => {
    setSyncSt('syncing'); setSyncMsg(undefined);
    try {
      const prov = new CapacitorHealthProvider();
      const fb = new WebHealthProvider();
      const hp = prov.isAvailable() ? prov : fb;
      const ok = await hp.requestPermissions();
      if (!ok) { setSyncSt('error'); setSyncMsg('Permission denied.'); return; }
      const since = new Date(); since.setDate(since.getDate() - 30);
      if (hp.importBodyComposition && activeProfile) {
        const recs = await hp.importBodyComposition(since, activeProfile);
        if (recs.length > 0) { await importMeasurements(recs); setSyncSt('success'); setSyncMsg(`Synced ${recs.length} records.`); }
        else { setSyncSt('success'); setSyncMsg('No new scans found.'); }
      } else { setSyncSt('error'); setSyncMsg('Not supported.'); }
    } catch (e) { setSyncSt('error'); setSyncMsg(e instanceof Error ? e.message : 'Sync failed'); }
  };

  return (
    <>
      <AppBar
        title="Today"
        overline={activeProfile ? `${greet()}, ${activeProfile.name} · ${todayDMY()}` : todayDMY()}
        actions={
          <>
            {quickAddButton}
            <button className="ui-icon-btn" aria-label="Settings" onClick={onOpenSettings}><Settings size={22} /></button>
          </>
        }
      />

      {/* Top category toolbar (Samsung Health style) */}
      <div style={{ padding: '0 16px', marginBottom: 12 }}>
        <CategoryToolbar tabs={CATEGORY_TABS} activeId={category} onSelect={id => setCategory(id as Category)} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 16px 140px' }}>
        {/* Active Workout Banner if session in progress */}
        <ActiveWorkoutBanner />

        {/* AI Energy Score — always visible at top */}
        <EnergyScore score={energyScore} breakdown={energyBreakdown} />

        {/* Activity category */}
        {category === 'activity' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <MetricTile
                label="Gym this week"
                valueText={`${gymWeek.daysThisWeek}/7`}
                icon={<CalendarCheck size={16} />}
                deltaText={`avg ${gymWeek.avgPerWeek}/wk`}
                deltaTone={gymWeek.daysThisWeek >= 3 ? 'positive' : 'neutral'}
              />
              <MetricTile
                label="Workouts (7d)"
                valueText={`${lastSevenDaysWorkoutsCount}`}
                icon={<Dumbbell size={16} />}
                deltaText="sessions"
              />
            </div>
            <WeeklyGoalCard
              workoutLogs={workoutHistory}
              weeklyGoalDays={activeProfile?.weeklyWorkoutGoalDays ?? 4}
            />
            <StepGoalCard
              currentSteps={8420}
              targetGoal={8000}
              streakDays={6}
              daysMetThisMonth={18}
              totalDaysInMonth={22}
            />
            <SleepRecoveryCard />
            <SyncCard state={syncSt} message={syncMsg} onSync={sync} />
          </>
        )}

        {/* Nutrition category */}
        {category === 'nutrition' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <MetricTile
                label="Calories"
                valueText={`${totalKcal.toFixed(2)} kcal`}
                icon={<Flame size={16} />}
                deltaText={foodLogs.length > 0 ? `${foodLogs.length} entries` : 'nothing logged'}
                deltaTone={foodLogs.length > 0 ? 'positive' : 'neutral'}
                onClick={openFood}
              />
              <MetricTile
                label="Protein"
                valueText={`${totalProtein.toFixed(2)} g`}
                icon={<Beef size={16} />}
                deltaText={totalProtein > 0 ? 'today' : undefined}
              />
            </div>
            <FoodTodayCard logs={foodLogs} onDelete={id => deleteFoodLog(id)} onAdd={openFood} />
          </>
        )}

        {/* Body category */}
        {category === 'body' && (
          <>
            <BodyGoalProgressCard
              measurements={measurements}
              targetWeightKg={activeProfile?.targetWeight ?? 74.0}
              targetBodyFatPct={activeProfile?.targetBodyFat ?? 15.0}
            />
            <MetricHeroCard latestWeightKg={latest?.weight ?? null} deltaKg={delta} onLogWeight={openWeight} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <MetricTile
                label="Body fat"
                valueText={latest?.bodyFat ? `${latest.bodyFat.toFixed(2)}%` : '—'}
                icon={<Activity size={16} />}
                deltaText={latest?.bodyFat ? 'of total mass' : undefined}
              />
              <MetricTile
                label="Muscle"
                valueText={latest?.muscleMass ? `${latest.muscleMass.toFixed(2)} kg` : '—'}
                icon={<Dumbbell size={16} />}
                deltaText={latest?.muscleMass ? 'lean mass' : undefined}
              />
            </div>
            <TrendCard points={trend} />
          </>
        )}

        {/* Weekly Goals category */}
        {category === 'goals' && (
          <>
            <WeeklyGoalCard
              workoutLogs={workoutHistory}
              weeklyGoalDays={activeProfile?.weeklyWorkoutGoalDays ?? 4}
            />
            <BodyGoalProgressCard
              measurements={measurements}
              targetWeightKg={activeProfile?.targetWeight ?? 74.0}
              targetBodyFatPct={activeProfile?.targetBodyFat ?? 15.0}
            />
            <SleepRecoveryCard />
          </>
        )}
      </div>

      <AddFoodSheet open={foodOpen} onClose={() => setFoodOpen(false)} onSubmit={e => addFoodLog(e)} />
      <LogWeightSheet open={wtOpen} onClose={() => setWtOpen(false)} onSubmit={w => addManualMeasurement(w)} />
    </>
  );
};