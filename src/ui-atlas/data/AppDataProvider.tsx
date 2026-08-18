import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Exercise } from '../../core/entities/Exercise';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
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
import { buildSessionDetail } from '../derive/sessionDetail';
import { buildSteps } from '../derive/steps';
import { buildTodayTraining } from '../derive/todayTraining';

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
  const dailySteps = useStore(s => s.dailySteps);
  const activeSession = useStore(s => s.activeSession);
  const savedRoutines = useStore(s => s.savedRoutines);
  const favoriteExerciseIds = useStore(s => s.favoriteExerciseIds);
  const lang = useStore(s => s.language);
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

  /**
   * Sets keyed by the workout they belong to.
   *
   * `activeWorkoutSets` is filled by an N+1 loop inside `loadWorkoutHistory` and
   * only ever covers that window, so a session older than it rendered as zero
   * volume. Grouping `allSets` — one query for everything ever — covers the whole
   * year of logs the history panel can reach. Falls back to the store's map for
   * the same reason `setsForDerivation` does: `allSets` comes from an endpoint an
   * older server deployment may not have.
   */
  const setsByLog = useMemo(() => {
    if (allSets.length === 0) return activeWorkoutSets;
    const grouped: Record<string, WorkoutSet[]> = {};
    for (const set of allSets) {
      if (!set.workoutLogId) continue;
      (grouped[set.workoutLogId] ??= []).push(set);
    }
    return grouped;
  }, [allSets, activeWorkoutSets]);

  const profile = useMemo(() => buildProfile(activeProfile), [activeProfile]);

  const body = useMemo(
    () => buildBody(measurements, activeProfile, at),
    [measurements, activeProfile, at],
  );

  const latestMeasurement = useMemo(
    () => [...measurements].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).at(-1) ?? null,
    [measurements],
  );

  /**
   * The catalogue keys on id, but history mostly carries names, so index by name
   * once — under both languages' names.
   *
   * Spanish was the gap. Everything the user sees and stores is `nameEs` once
   * they switch language: the picker shows it, a logged set records it, and a
   * routine the coach writes names it. Indexing English alone meant every one of
   * those failed to resolve back to a catalogue row, and the row is where the
   * gif, still, target and equipment live — so a Spanish session showed two
   * initials where the animation belongs. Resolution by id was unaffected, which
   * is why only *some* exercises lost their gif: the ones that arrived without
   * one.
   *
   * English is written second so it wins any tie. Nothing in the dataset
   * actually ties — no Spanish name matches a different exercise's English name
   * — but the day one does, the app's own catalogue name should be the one that
   * survives.
   */
  const exercisesByName = useMemo(() => {
    const index = new Map<string, Exercise>();
    if (catalog) {
      const all = catalog.search('');
      // An empty key would match every unnamed set, so it is never indexed.
      const add = (name: string | undefined, exercise: Exercise) => {
        const key = normalizeName(name ?? '');
        if (key) index.set(key, exercise);
      };
      for (const exercise of all) add(exercise.nameEs, exercise);
      for (const exercise of all) add(exercise.name, exercise);
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

  /**
   * A year of sessions, not 120 days.
   *
   * `yearLogs` is already fetched for the best-streak calculation, and now that
   * `setsByLog` can supply sets for any of them the history panel can reach back
   * a full year for free. Today and the Train hub slice this, so nothing else
   * changes. Merged rather than picked: `workoutHistory` holds anything
   * `extendWorkoutHistory` has since pulled in from beyond that year, and is the
   * only source at all if the range call failed.
   */
  const logsForHistory = useMemo(() => {
    const byId = new Map(yearLogs.map(log => [log.id, log]));
    for (const log of workoutHistory) byId.set(log.id, log);
    return [...byId.values()];
  }, [yearLogs, workoutHistory]);

  const history = useMemo(
    () => buildHistory(logsForHistory, setsByLog, prSetIds),
    [logsForHistory, setsByLog, prSetIds],
  );

  const training = useMemo(() => ({
    history,
    today: buildTodayTraining(history, at),
    records: buildPersonalRecords(setsForDerivation),
    muscleLoad,
    streak: buildStreak(logsForHistory, activeProfile?.weeklyWorkoutGoalDays, at),
    weeklyVolumeKg: buildWeeklyVolume(logsForHistory, setsByLog, at),
    weeklyStats: buildWeeklyStats(logsForHistory, setsByLog, at),
    routines: savedRoutines,
  }), [history, setsForDerivation, muscleLoad, logsForHistory, setsByLog, activeProfile?.weeklyWorkoutGoalDays, savedRoutines, at]);

  const steps = useMemo(() => buildSteps(dailySteps, at), [dailySteps, at]);

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
    toItem: exercise => toCatalogItem(exercise, usage, favorites, lang),
  }), [catalog, usage, favorites, lang]);

  const exerciseHistory = useCallback(
    (exerciseName: string) => buildExerciseHistory(setsForDerivation, exerciseName),
    [setsForDerivation],
  );

  const sessionDetail = useCallback(
    (workoutLogId: string) => {
      const log = logsForHistory.find(entry => entry.id === workoutLogId);
      if (!log) return null;
      return buildSessionDetail(log, setsByLog[workoutLogId] ?? [], prSetIds, resolveExerciseByName);
    },
    [logsForHistory, setsByLog, prSetIds, resolveExerciseByName],
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
    steps,
    catalog: catalogSlice,
    coach: { thread: chatHistory, isLoading: isAiLoading },
    exerciseHistory,
    sessionDetail,
  }), [activeProfile, profile, body, session, sessionExercises, sessionTotals, cursor, training, nutrition, steps, catalogSlice, chatHistory, isAiLoading, exerciseHistory, sessionDetail]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

