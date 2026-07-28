import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Exercise } from '../../core/entities/Exercise';
import { getExerciseCatalog, type ExerciseCatalog, type FacetCounts } from '../../data/exercises/ExerciseCatalog';
import { useStore } from '../../presentation/state/store';
import type { SessionVM } from '../types';
import type { CatalogSlice, AppData } from './types';
import { AppDataContext } from './contexts';
import { buildBody } from '../derive/bodyMetrics';
import { buildProfile } from '../derive/profile';
import { buildMuscleLoad } from '../derive/muscleLoad';
import { buildNutrition } from '../derive/nutrition';
import { annotatePrs, bestBefore, buildExerciseUsage, buildPersonalRecords, normalizeName } from '../derive/records';
import { buildStreak } from '../derive/streak';
import { buildHistory, buildWeeklyStats, buildWeeklyVolume } from '../derive/history';
import { buildSessionExercises, buildSessionTotals, findCursor } from '../derive/session';
import { toCatalogItem } from '../derive/catalog';
import { buildExerciseHistory } from '../derive/exerciseHistory';

/**
 * One provider, composed once per mount.
 *
 * Not a view-model hook per screen: `streak` is read by three screens,
 * `sessionTotals` by four and `muscleLoad` by four, so per-screen hooks would
 * derive the same values several times over. Both skins consume the identical
 * object, which also means switching skin re-renders markup and nothing else.
 *
 * Nothing here holds a ticking value. The session clock would re-render every
 * screen every second, so it lives in `components/useTicker` instead.
 */

const EMPTY_FACETS: FacetCounts = { category: [], equipment: [] };
const HISTORY_DAYS = 120; // covers the 12-week volume chart with room to spare

export const AppDataProvider: React.FC<{ children: React.ReactNode; now?: Date }> = ({ children, now }) => {
  const activeProfile = useStore(s => s.activeProfile);
  const measurements = useStore(s => s.measurements);
  const foodLogs = useStore(s => s.foodLogs);
  const workoutLogs = useStore(s => s.workoutLogs);
  const workoutHistory = useStore(s => s.workoutHistory);
  const activeWorkoutSets = useStore(s => s.activeWorkoutSets);
  const allSets = useStore(s => s.allSets);
  const activeSession = useStore(s => s.activeSession);
  const savedRoutines = useStore(s => s.savedRoutines);
  const favoriteExerciseIds = useStore(s => s.favoriteExerciseIds);
  const chatHistory = useStore(s => s.chatHistory);
  const isAiLoading = useStore(s => s.isAiLoading);
  const getExerciseStats = useStore(s => s.getExerciseStats);

  const [catalog, setCatalog] = useState<ExerciseCatalog | null>(null);
  const [yearLogs, setYearLogs] = useState(workoutHistory);

  /**
   * `now` is resolved once per mount rather than per render: recomputing it every
   * time would make every memo below unstable and re-derive the whole tree.
   * Held in lazily-initialised state rather than a ref, because reading a ref
   * during render is not allowed. Screens that must tick use `useTicker`.
   */
  const [at] = useState(() => now ?? new Date());

  // The catalogue is a 1 MB lazy chunk; Library waits for it, nothing else does.
  useEffect(() => {
    let cancelled = false;
    getExerciseCatalog().then(
      c => { if (!cancelled) setCatalog(c); },
      err => console.error('Exercise catalog failed to load', err),
    );
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeProfile?.id) return;
    const store = useStore.getState();

    // Every loader is individually guarded. In server mode these are network
    // calls, and one unavailable endpoint must degrade that slice rather than
    // reject unhandled and take the rest of the screen's data with it.
    const guard = (what: string) => (err: unknown) => console.warn(`[skins] ${what} unavailable`, err);

    store.loadWorkoutHistory(HISTORY_DAYS).catch(guard('workout history'));
    store.loadAllSets().catch(guard('all sets'));
    store.loadSavedRoutines().catch(guard('routines'));
    store.loadFavorites().catch(guard('favorites'));

    // A year of logs (without their sets — `loadWorkoutRange` skips those) is
    // what the best-streak calculation needs, and it is cheap.
    const start = new Date(at.getTime() - 365 * 86_400_000);
    store.loadWorkoutRange(start, at).then(setYearLogs, guard('workout range'));
  }, [activeProfile?.id, at]);

  /**
   * Sets to derive records and muscle load from.
   *
   * `allSets` is the all-time history and the honest source for personal
   * records. It comes from a single endpoint that may not exist on an older
   * server deployment, so this falls back to the sets already loaded alongside
   * the workout history — a shorter window, but the difference between a
   * slightly conservative PR list and a screen full of zeros.
   */
  const setsForDerivation = useMemo(
    () => (allSets.length > 0 ? allSets : Object.values(activeWorkoutSets).flat()),
    [allSets, activeWorkoutSets],
  );

  const profile = useMemo(() => buildProfile(activeProfile), [activeProfile]);

  const body = useMemo(
    () => buildBody(measurements, activeProfile, at),
    [measurements, activeProfile, at],
  );

  const latestMeasurement = useMemo(
    () => [...measurements].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).at(-1) ?? null,
    [measurements],
  );

  // The catalogue keys on id, but history mostly carries names, so index by name once.
  const exercisesByName = useMemo(() => {
    const index = new Map<string, Exercise>();
    if (catalog) {
      for (const exercise of catalog.search('')) index.set(normalizeName(exercise.name), exercise);
    }
    return index;
  }, [catalog]);

  const resolveExerciseByName = useCallback(
    (set: { exerciseId?: string; exerciseName: string }): Exercise | undefined =>
      (set.exerciseId ? catalog?.getById(set.exerciseId) : undefined)
      ?? exercisesByName.get(normalizeName(set.exerciseName)),
    [catalog, exercisesByName],
  );

  const prSetIds = useMemo(() => annotatePrs(setsForDerivation), [setsForDerivation]);
  const usage = useMemo(() => buildExerciseUsage(setsForDerivation), [setsForDerivation]);

  const recentSets = useMemo(() => {
    const since = at.getTime() - 7 * 86_400_000;
    return setsForDerivation.filter(s => new Date(s.timestamp).getTime() >= since);
  }, [setsForDerivation, at]);

  const muscleLoad = useMemo(
    () => buildMuscleLoad(recentSets, resolveExerciseByName, at),
    [recentSets, resolveExerciseByName, at],
  );

  const history = useMemo(
    () => buildHistory(workoutHistory, activeWorkoutSets, prSetIds),
    [workoutHistory, activeWorkoutSets, prSetIds],
  );

  const training = useMemo(() => ({
    history,
    records: buildPersonalRecords(setsForDerivation),
    muscleLoad,
    streak: buildStreak(yearLogs.length ? yearLogs : workoutHistory, activeProfile?.weeklyWorkoutGoalDays, at),
    weeklyVolumeKg: buildWeeklyVolume(workoutHistory, activeWorkoutSets, at),
    weeklyStats: buildWeeklyStats(workoutHistory, activeWorkoutSets, at),
    routines: savedRoutines,
  }), [history, setsForDerivation, muscleLoad, yearLogs, workoutHistory, activeWorkoutSets, activeProfile?.weeklyWorkoutGoalDays, savedRoutines, at]);

  const nutrition = useMemo(
    () => buildNutrition(foodLogs, workoutLogs, activeProfile, latestMeasurement, at),
    [foodLogs, workoutLogs, activeProfile, latestMeasurement, at],
  );

  const sessionExercises = useMemo(() => {
    if (!activeSession) return [];
    const baseline = bestBefore(setsForDerivation, activeSession.startTime);
    return buildSessionExercises(
      activeSession.routineExercises,
      activeSession.sets,
      resolveExerciseByName,
      getExerciseStats,
      baseline,
      usage,
    );
  }, [activeSession, setsForDerivation, resolveExerciseByName, getExerciseStats, usage]);

  const sessionTotals = useMemo(() => buildSessionTotals(sessionExercises), [sessionExercises]);
  const cursor = useMemo(() => findCursor(sessionExercises), [sessionExercises]);

  const session: SessionVM | null = useMemo(
    () => activeSession
      ? {
          title: activeSession.workoutType,
          startedAt: activeSession.startTime,
          routineSource: activeSession.routineSource,
          feelingTag: activeSession.feelingTag,
          bodyNotes: activeSession.bodyNotes,
        }
      : null,
    [activeSession],
  );

  const favorites = useMemo(() => new Set(favoriteExerciseIds), [favoriteExerciseIds]);

  const catalogSlice: CatalogSlice = useMemo(() => ({
    ready: catalog !== null,
    total: catalog?.size ?? 0,
    facets: catalog?.facetCounts() ?? EMPTY_FACETS,
    // Delegates straight to the catalogue's own ranked search — 1,324 entries are
    // never mapped into view models, only the sliced result a screen actually shows.
    search: (query, filters) => catalog?.search(query, filters) ?? [],
    byId: id => catalog?.getById(id),
    toItem: exercise => toCatalogItem(exercise, usage, favorites),
  }), [catalog, usage, favorites]);

  const exerciseHistory = useCallback(
    (exerciseName: string) => buildExerciseHistory(setsForDerivation, exerciseName),
    [setsForDerivation],
  );

  const value: AppData = useMemo(() => ({
    ready: Boolean(activeProfile),
    profile,
    body,
    session,
    sessionExercises,
    sessionTotals,
    cursor,
    training,
    nutrition,
    catalog: catalogSlice,
    coach: { thread: chatHistory, isLoading: isAiLoading },
    exerciseHistory,
  }), [activeProfile, profile, body, session, sessionExercises, sessionTotals, cursor, training, nutrition, catalogSlice, chatHistory, isAiLoading, exerciseHistory]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

