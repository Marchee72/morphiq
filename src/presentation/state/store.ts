import { create } from 'zustand';
import type { UserProfile } from '../../core/entities/UserProfile';
import { getAge } from '../../core/entities/UserProfile';
import type { Measurement } from '../../core/entities/Measurement';
import type { FoodLog } from '../../core/entities/FoodLog';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { Message } from '../../core/entities/Message';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import {
  UserProfileRepository,
  MeasurementRepository,
  FoodLogRepository,
  WorkoutLogRepository,
  MessageRepository,
  WorkoutSetRepository,
  FavoriteExerciseRepository,
} from '../../data/database/LocalDatabase';
import {
  ServerUserProfileRepository,
  ServerMeasurementRepository,
  ServerFoodLogRepository,
  ServerWorkoutLogRepository,
  ServerMessageRepository,
  ServerWorkoutSetRepository,
  ServerFavoriteExerciseRepository,
} from '../../data/database/ServerDatabase';
import { DeepSeekCoach, chatCompletion, buildProviderFromEnv } from '../../data/ai/GeminiCoach';

import { Capacitor } from '@capacitor/core';

// Repository instances — switch between local IndexedDB and remote server via env vars
const isServer = (import.meta.env?.VITE_DB_TYPE as string) === 'server' && !(typeof window !== 'undefined' && window.location.search.includes('db=local'));
const profileRepo = isServer ? new ServerUserProfileRepository() : new UserProfileRepository();
const measurementRepo = isServer ? new ServerMeasurementRepository() : new MeasurementRepository();
const foodRepo = isServer ? new ServerFoodLogRepository() : new FoodLogRepository();
const workoutRepo = isServer ? new ServerWorkoutLogRepository() : new WorkoutLogRepository();
const messageRepo = isServer ? new ServerMessageRepository() : new MessageRepository();
const workoutSetRepo = isServer ? new ServerWorkoutSetRepository() : new WorkoutSetRepository();
const favoriteRepo = isServer ? new ServerFavoriteExerciseRepository() : new FavoriteExerciseRepository();

// AI Coach adapter
const aiCoach = new DeepSeekCoach();

interface StoreState {
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  measurements: Measurement[];
  foodLogs: FoodLog[];
  workoutLogs: WorkoutLog[];
  workoutHistory: WorkoutLog[];
  chatHistory: Message[];
  favoriteExerciseIds: string[];
  activeWorkoutSets: Record<string, WorkoutSet[]>;
  exerciseStats: Record<string, { maxWeight: number; avgWeight: number; avgReps: number } | null>;

  // Configuration
  selectedDate: Date;
  apiKey: string;
  isAiLoading: boolean;
  selectedWorkoutForCoach: WorkoutLog | null;
  activeCoachSubTab: 'chat' | 'routine' | 'history';
  activeTab: 'home' | 'gym' | 'exercises' | 'coach' | 'settings';
  activeWorkout: WorkoutLog | null;
  isGymModeOpen: boolean;

  // Actions
  setActiveTab: (tab: 'home' | 'gym' | 'exercises' | 'coach' | 'settings') => void;
  setSelectedWorkoutForCoach: (workout: WorkoutLog | null) => void;
  setActiveCoachSubTab: (tab: 'chat' | 'routine' | 'history') => void;
  setActiveWorkout: (workout: WorkoutLog | null) => void;
  setIsGymModeOpen: (open: boolean) => void;
  loadProfiles: () => Promise<void>;
  setActiveProfile: (id: string) => Promise<void>;
  createProfile: (profile: Omit<UserProfile, 'createdAt'>) => Promise<string>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  
  addManualMeasurement: (weightKg: number) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
  
  addFoodLog: (log: Omit<FoodLog, 'profileId' | 'timestamp'>) => Promise<void>;
  deleteFoodLog: (id: string) => Promise<void>;
  
  addWorkoutLog: (log: Omit<WorkoutLog, 'profileId' | 'timestamp'>) => Promise<string>;
  deleteWorkoutLog: (id: string) => Promise<void>;
  loadWorkoutHistory: (days?: number) => Promise<void>;
  loadWorkoutRange: (start: Date, end: Date) => Promise<WorkoutLog[]>;
  importWorkouts: (logs: Omit<WorkoutLog, 'profileId'>[]) => Promise<void>;

  loadSetsForWorkout: (workoutLogId: string) => Promise<void>;
  addWorkoutSet: (set: Omit<WorkoutSet, 'profileId' | 'timestamp'>) => Promise<void>;
  deleteWorkoutSet: (id: string, workoutLogId: string) => Promise<void>;
  loadExerciseStats: (exerciseName: string) => Promise<void>;
  getSetsForExercise: (exerciseName: string) => Promise<WorkoutSet[]>;
  analyzeWorkoutRoutine: (workoutLogId: string) => Promise<string>;
  
  sendChatMessage: (content: string) => Promise<void>;
  clearChat: () => Promise<void>;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (exerciseId: string) => Promise<void>;
  linkPendingRoutineToWorkout: (workoutLogId: string) => Promise<void>;
  clearPendingRoutine: () => Promise<void>;
  importMeasurements: (records: Omit<Measurement, 'profileId'>[]) => Promise<void>;
  analyzeWorkoutHistoryPeriod: (period: 'week' | 'month' | 'year') => Promise<string>;
  scheduleMonthlyReminder: () => Promise<void>;
  cancelMonthlyReminder: () => Promise<void>;
  
  setApiKey: (key: string) => void;
  setSelectedDate: (date: Date) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  profiles: [],
  activeProfile: null,
  measurements: [],
  foodLogs: [],
  workoutLogs: [],
  workoutHistory: [],
  chatHistory: [],
  favoriteExerciseIds: [],
  activeWorkoutSets: {},
  exerciseStats: {},
  selectedWorkoutForCoach: null,
  activeCoachSubTab: 'chat',
  activeTab: 'home',
  activeWorkout: null,
  isGymModeOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedWorkoutForCoach: (workout) => set({ selectedWorkoutForCoach: workout }),
  setActiveCoachSubTab: (tab) => set({ activeCoachSubTab: tab }),
  setActiveWorkout: (workout) => set({ activeWorkout: workout }),
  setIsGymModeOpen: (open) => set({ isGymModeOpen: open }),

  selectedDate: new Date(),
  apiKey: (import.meta.env?.VITE_DEEPSEEK_API_KEY as string) || '',
  isAiLoading: false,

  loadProfiles: async () => {
    const list = await profileRepo.getAll();
    set({ profiles: list });
    if (list.length > 0) {
      // Auto-set the first profile if none is active
      const active = get().activeProfile;
      if (!active || !list.find(p => p.id === active.id)) {
        await get().setActiveProfile(list[0].id!);
      }
    } else {
      set({ activeProfile: null, measurements: [], foodLogs: [], workoutLogs: [], workoutHistory: [], chatHistory: [], favoriteExerciseIds: [], activeWorkoutSets: {}, exerciseStats: {} });
    }
  },

  setActiveProfile: async (id: string) => {
    const profile = await profileRepo.get(id);
    if (profile) {
      set({ activeProfile: profile });
      
      // Migration: Convert synced workouts duration from seconds to minutes if stored incorrectly (duration > 300)
      try {
        const allWorkoutsForMigration = await workoutRepo.getAll(id);
        const workoutsToMigrate = allWorkoutsForMigration.filter(w => w.source === 'health-connect' && w.duration > 300);
        if (workoutsToMigrate.length > 0) {
          console.log(`MorphIQ Store: Migrating ${workoutsToMigrate.length} workout logs from seconds to minutes...`);
          for (const w of workoutsToMigrate) {
            w.duration = Math.round(w.duration / 60);
            await workoutRepo.update(w);
          }
        }
      } catch (err) {
        console.error('Failed to run workout duration migration:', err);
      }

      const history = await measurementRepo.getAll(id);
      const foods = await foodRepo.getAll(id, get().selectedDate);
      const workouts = await workoutRepo.getAll(id, get().selectedDate);
      
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const workoutHist = await workoutRepo.getRange(id, start, end);
      
      const chat = await messageRepo.getAll(id);

      const workoutSets: Record<string, WorkoutSet[]> = {};
      const pendingSets = await workoutSetRepo.getForWorkout('pending');
      workoutSets['pending'] = pendingSets;
      
      let activeWorkout = null;
      if (pendingSets.length > 0) {
        activeWorkout = {
          id: 'pending',
          profileId: id,
          type: 'Strength Training',
          duration: 0,
          description: 'Pending Workout Routine',
          source: 'manual' as const,
          timestamp: new Date(),
        };
      }

      for (const w of workouts) {
        if (w.id) {
          workoutSets[w.id] = await workoutSetRepo.getForWorkout(w.id);
        }
      }
      for (const w of workoutHist) {
        if (w.id && !workoutSets[w.id]) {
          workoutSets[w.id] = await workoutSetRepo.getForWorkout(w.id);
        }
      }

      set({
        measurements: history,
        foodLogs: foods,
        workoutLogs: workouts,
        workoutHistory: workoutHist,
        chatHistory: chat,
        activeWorkoutSets: workoutSets,
        activeWorkout,
      });
      get().loadFavorites();
    }
  },

  createProfile: async (profileData) => {
    const newId = await profileRepo.create({
      ...profileData,
      createdAt: new Date(),
    });
    await get().loadProfiles();
    await get().setActiveProfile(newId);
    return newId;
  },

  updateProfile: async (profile) => {
    await profileRepo.update(profile);
    await get().loadProfiles();
    if (get().activeProfile?.id === profile.id) {
      set({ activeProfile: profile });
    }
  },

  deleteProfile: async (id) => {
    await profileRepo.delete(id);
    if (get().activeProfile?.id === id) {
      set({ activeProfile: null });
    }
    await get().loadProfiles();
  },

  addManualMeasurement: async (weightKg) => {
    const profile = get().activeProfile;
    if (!profile?.id) return;
    if (!Number.isFinite(weightKg) || weightKg < 15 || weightKg > 400) return;

    const bmi = weightKg / Math.pow(profile.height / 100, 2);
    const age = getAge(profile.birthDate);
    const bmr = profile.gender === 'male'
      ? 66.47 + 13.75 * weightKg + 5.003 * profile.height - 6.755 * age
      : 655.1 + 9.563 * weightKg + 1.85 * profile.height - 4.676 * age;

    await measurementRepo.save({
      profileId: profile.id, timestamp: new Date(), weight: weightKg,
      impedance: 0, bmi: Number(bmi.toFixed(2)), bmr: Number(bmr.toFixed(2)),
      bodyFat: 0, bodyWater: 0, boneMass: 0, muscleMass: 0,
      visceralFat: 0, metabolicAge: 0, protein: 0, bodyType: 4,
    });
    set({ measurements: await measurementRepo.getAll(profile.id) });
  },

  deleteMeasurement: async (id) => {
    await measurementRepo.delete(id);
    const profile = get().activeProfile;
    if (profile) {
      const history = await measurementRepo.getAll(profile.id!);
      set({ measurements: history });
    }
  },

  addFoodLog: async (logData) => {
    const profile = get().activeProfile;
    if (!profile) return;
    await foodRepo.add({
      ...logData,
      profileId: profile.id!,
      timestamp: get().selectedDate,
    });
    const foods = await foodRepo.getAll(profile.id!, get().selectedDate);
    set({ foodLogs: foods });
  },

  deleteFoodLog: async (id) => {
    await foodRepo.delete(id);
    const profile = get().activeProfile;
    if (profile) {
      const foods = await foodRepo.getAll(profile.id!, get().selectedDate);
      set({ foodLogs: foods });
    }
  },

  addWorkoutLog: async (workoutData) => {
    const profile = get().activeProfile;
    if (!profile) return '';
    const logId = await workoutRepo.add({
      ...workoutData,
      profileId: profile.id!,
      timestamp: get().selectedDate,
    });
    const workouts = await workoutRepo.getAll(profile.id!, get().selectedDate);
    const workoutSets = { ...get().activeWorkoutSets };
    workoutSets[logId] = [];
    set({ workoutLogs: workouts, activeWorkoutSets: workoutSets });
    await get().loadWorkoutHistory(30);
    return logId;
  },

  deleteWorkoutLog: async (id) => {
    await workoutRepo.delete(id);
    const profile = get().activeProfile;
    if (profile) {
      const workouts = await workoutRepo.getAll(profile.id!, get().selectedDate);
      const workoutSets = { ...get().activeWorkoutSets };
      delete workoutSets[id];
      set({ workoutLogs: workouts, activeWorkoutSets: workoutSets });
      await get().loadWorkoutHistory(30);
    }
  },

  sendChatMessage: async (content) => {
    const profile = get().activeProfile;
    if (!profile) return;

    // 1. Add user message to DB & State
    const userMsg: Message = {
      profileId: profile.id!,
      timestamp: new Date(),
      sender: 'user',
      content,
    };
    await messageRepo.add(userMsg);
    set(state => ({ chatHistory: [...state.chatHistory, userMsg] }));

    // 2. Fetch recent context for RAG
    set({ isAiLoading: true });
    
    try {
      const history = get().measurements;
      const latest = history.length > 0 ? history[history.length - 1] : undefined;
      const foods = get().foodLogs;
      
      const recentWorkouts = get().workoutHistory.slice(0, 5);
      const recentWorkoutSets: WorkoutSet[] = [];
      for (const w of recentWorkouts) {
        if (w.id) {
          const sets = get().activeWorkoutSets[w.id] || await workoutSetRepo.getForWorkout(w.id);
          recentWorkoutSets.push(...sets);
        }
      }

      const context = {
        profile,
        latestMeasurement: latest,
        measurementHistory: history,
        recentFoodLogs: foods,
        recentWorkoutLogs: get().workoutHistory.slice(0, 10),
        chatHistory: get().chatHistory,
        recentWorkoutSets,
      };

      // 3. Request Gemini Coach response
      const answer = await aiCoach.generateResponse(context, content, get().apiKey);

      // 4. Save AI message to DB & State
      const aiMsg: Message = {
        profileId: profile.id!,
        timestamp: new Date(),
        sender: 'assistant',
        content: answer,
      };
      await messageRepo.add(aiMsg);
      set(state => ({ chatHistory: [...state.chatHistory, aiMsg] }));
    } catch (err: unknown) {
      console.error('Chat error:', err);
    } finally {
      set({ isAiLoading: false });
    }
  },

  clearChat: async () => {
    const profile = get().activeProfile;
    if (profile) {
      await messageRepo.clear(profile.id!);
      set({ chatHistory: [] });
    }
  },

  setApiKey: () => {
    // No-op: API key configuration is handled through project environment variables
  },

  setSelectedDate: async (date) => {
    set({ selectedDate: date });
    const profile = get().activeProfile;
    if (profile) {
      const foods = await foodRepo.getAll(profile.id!, date);
      const workouts = await workoutRepo.getAll(profile.id!, date);
      const workoutSets = { ...get().activeWorkoutSets };
      for (const w of workouts) {
        if (w.id) {
          workoutSets[w.id] = await workoutSetRepo.getForWorkout(w.id);
        }
      }
      set({ foodLogs: foods, workoutLogs: workouts, activeWorkoutSets: workoutSets });
    }
  },

  loadWorkoutHistory: async (days = 30) => {
    const profile = get().activeProfile;
    if (!profile) return;
    const end = new Date();
    end.setDate(end.getDate() + 1); // Allow tomorrow to catch today's future workouts/drift
    const start = new Date();
    start.setDate(start.getDate() - days);
    const logs = await workoutRepo.getRange(profile.id!, start, end);
    const workoutSets = { ...get().activeWorkoutSets };
    for (const w of logs) {
      if (w.id && !workoutSets[w.id]) {
        workoutSets[w.id] = await workoutSetRepo.getForWorkout(w.id);
      }
    }
    set({ workoutHistory: logs, activeWorkoutSets: workoutSets });
  },

  loadWorkoutRange: async (start: Date, end: Date) => {
    const profile = get().activeProfile;
    if (!profile) return [];
    return await workoutRepo.getRange(profile.id!, start, end);
  },

  importWorkouts: async (logs: Omit<WorkoutLog, 'profileId'>[]) => {
    const profile = get().activeProfile;
    if (!profile) return;
    
    const end = new Date();
    end.setDate(end.getDate() + 1); // tomorrow
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const existing = await workoutRepo.getRange(profile.id!, start, end);
    const existingExtIds = new Set(existing.map(w => w.externalId).filter(Boolean));
    
    console.log('MorphIQ Store: importWorkouts received logs count:', logs.length);
    console.log('MorphIQ Store: Existing external IDs in DB:', Array.from(existingExtIds));

    let addedCount = 0;
    for (const log of logs) {
      if (log.externalId && existingExtIds.has(log.externalId)) {
        console.log('MorphIQ Store: Skipping duplicate workout:', log.externalId);
        continue;
      }
      console.log('MorphIQ Store: Saving new synced workout:', log.externalId || log.timestamp);
      const newLogId = await workoutRepo.add({
        ...log,
        profileId: profile.id!,
        timestamp: new Date(log.timestamp),
      });
      addedCount++;

      // Automatically check for overlapping manual workouts on the same day with sets to merge
      const syncDate = new Date(log.timestamp);
      // We will look for manual workouts logged within 4 hours of the synced workout
      const candidateWorkouts = existing.filter(w => 
        w.source === 'manual' &&
        w.id !== newLogId &&
        Math.abs(new Date(w.timestamp).getTime() - syncDate.getTime()) < 4 * 60 * 60 * 1000
      );

      for (const candidate of candidateWorkouts) {
        if (candidate.id) {
          const candidateSets = await workoutSetRepo.getForWorkout(candidate.id);
          if (candidateSets.length > 0) {
            console.log(`MorphIQ Store: Merging ${candidateSets.length} sets from manual workout ${candidate.id} to synced workout ${newLogId}`);
            // Re-associate sets to newLogId
            for (const s of candidateSets) {
              if (s.id) {
                await workoutSetRepo.delete(s.id);
                await workoutSetRepo.add({
                  ...s,
                  id: undefined, // let DB generate new ID
                  workoutLogId: newLogId,
                });
              }
            }
            // Delete the manual candidate workout
            await workoutRepo.delete(candidate.id);
            console.log(`MorphIQ Store: Deleted manual workout ${candidate.id}`);
          }
        }
      }
    }
    console.log('MorphIQ Store: Finished inserting new workouts. Total added:', addedCount);
    
    await get().loadWorkoutHistory(30);
    const todayWorkouts = await workoutRepo.getAll(profile.id!, get().selectedDate);
    const workoutSets = { ...get().activeWorkoutSets };
    for (const w of todayWorkouts) {
      if (w.id && !workoutSets[w.id]) {
        workoutSets[w.id] = await workoutSetRepo.getForWorkout(w.id);
      }
    }
    set({ workoutLogs: todayWorkouts, activeWorkoutSets: workoutSets });
  },

  loadSetsForWorkout: async (workoutLogId) => {
    const sets = await workoutSetRepo.getForWorkout(workoutLogId);
    set(state => ({
      activeWorkoutSets: {
        ...state.activeWorkoutSets,
        [workoutLogId]: sets
      }
    }));
  },

  addWorkoutSet: async (setData) => {
    const profile = get().activeProfile;
    if (!profile) return;
    const newSet: WorkoutSet = {
      ...setData,
      profileId: profile.id!,
      timestamp: new Date()
    };
    await workoutSetRepo.add(newSet);
    await get().loadSetsForWorkout(setData.workoutLogId);
    await get().loadExerciseStats(setData.exerciseName);
  },

  deleteWorkoutSet: async (id, workoutLogId) => {
    const sets = get().activeWorkoutSets[workoutLogId] || [];
    const setObj = sets.find(s => s.id === id);
    const exerciseName = setObj?.exerciseName;

    await workoutSetRepo.delete(id);
    await get().loadSetsForWorkout(workoutLogId);
    if (exerciseName) {
      await get().loadExerciseStats(exerciseName);
    }
  },

  loadExerciseStats: async (exerciseName) => {
    const profile = get().activeProfile;
    if (!profile) return;
    const sets = await workoutSetRepo.getForExercise(profile.id!, exerciseName);
    if (sets.length === 0) {
      set(state => ({
        exerciseStats: {
          ...state.exerciseStats,
          [exerciseName]: null
        }
      }));
      return;
    }
    
    let maxWeight = 0;
    let totalWeight = 0;
    let totalReps = 0;
    let weightCount = 0;
    let repsCount = 0;
    for (const s of sets) {
      if (s.weight != null) {
        if (s.weight > maxWeight) maxWeight = s.weight;
        totalWeight += s.weight;
        weightCount++;
      }
      if (s.reps != null) {
        totalReps += s.reps;
        repsCount++;
      }
    }
    const avgWeight = weightCount > 0 ? totalWeight / weightCount : 0;
    const avgReps = repsCount > 0 ? totalReps / repsCount : 0;

    set(state => ({
      exerciseStats: {
        ...state.exerciseStats,
        [exerciseName]: {
          maxWeight,
          avgWeight,
          avgReps
        }
      }
    }));
  },

  getSetsForExercise: async (exerciseName) => {
    const profile = get().activeProfile;
    if (!profile) return [];
    return await workoutSetRepo.getForExercise(profile.id!, exerciseName);
  },

  analyzeWorkoutRoutine: async (workoutLogId) => {
    const activeSets = get().activeWorkoutSets[workoutLogId] || [];
    const workout = get().workoutLogs.find(w => w.id === workoutLogId) || get().workoutHistory.find(w => w.id === workoutLogId);
    if (!workout) return 'Workout session not found.';
    if (activeSets.length === 0) {
      return 'No routine exercises found for this workout. Please add some exercises and sets first to analyze your routine!';
    }
    
    // Group sets by exercise name
    const grouped: Record<string, WorkoutSet[]> = {};
    for (const s of activeSets) {
      if (!grouped[s.exerciseName]) grouped[s.exerciseName] = [];
      grouped[s.exerciseName].push(s);
    }
    
    // Sort the exercises chronologically by their earliest set timestamp
    const sortedGrouped = Object.entries(grouped).sort((a, b) => {
      const aMinTime = Math.min(...a[1].map(s => new Date(s.timestamp || 0).getTime()));
      const bMinTime = Math.min(...b[1].map(s => new Date(s.timestamp || 0).getTime()));
      return aMinTime - bMinTime;
    });
    
    let exerciseListStr = '';
    for (const [exName, sets] of sortedGrouped) {
      // Sort sets chronologically
      const sortedSets = [...sets].sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
      
      exerciseListStr += `- **${exName}**:\n`;
      for (const s of sortedSets) {
        const setTime = s.timestamp ? new Date(s.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
        let setDetails: string;
        if (s.weight !== undefined && s.weight !== null && s.reps !== undefined && s.reps !== null) {
          setDetails = `${s.weight.toFixed(2)} kg/lbs x ${s.reps} reps`;
        } else {
          const parts: string[] = [];
          if (s.distanceKm !== undefined && s.distanceKm !== null) parts.push(`${s.distanceKm.toFixed(2)} km`);
          if (s.duration !== undefined && s.duration !== null) parts.push(`${s.duration} mins`);
          if (s.speed !== undefined && s.speed !== null) parts.push(`${s.speed.toFixed(1)} km/h`);
          setDetails = parts.join(' @ ') || 'No details logged';
        }
        exerciseListStr += `  * Set ${s.setNumber}${setTime ? ` (${setTime})` : ''}: ${setDetails}\n`;
      }
    }

    const prompt = `You are a certified Strength and Conditioning Specialist (CSCS).
Analyze the following workout routine logged by the user:
Workout Type: ${workout.type}
Description: ${workout.description}
Duration: ${workout.duration} minutes

Logged Exercises and Sets:
${exerciseListStr}

Please provide a structured, professional, and constructive analysis. Include the following sections and formatting:
1. **Routine Type**: Classify the routine (e.g. Hypertrophy, Strength, Endurance, Full-Body, Split).
2. **Routine Score**: Assign a performance/structure score out of 100 (e.g., 85/100) with a brief justification.
3. **What's Good**: Outline what is designed well or executed correctly in terms of volume, intensity, or exercise choice.
4. **What's Wrong**: Address areas of weakness, imbalances, incorrect loading, or inefficiencies.
5. **CSCS Recommendations**: Provide 2-3 concrete, actionable progressive overload recommendations or form/rest tips.

Keep the tone professional, motivating, and science-grounded. Keep the response concise but highly actionable. Avoid boilerplate disclaimers. Use markdown headers (###) and bullet lists.`;

    const provider = buildProviderFromEnv();
    const storeKey = get().apiKey;
    if (storeKey) provider.apiKey = storeKey;

    if (!provider.apiKey && !provider.baseUrl.includes('localhost')) {
      return 'No API key configured. Set VITE_LLM_API_KEY in your .env file to enable workout routine analysis.';
    }

    const systemInstruction = "You are MorphIQ, an elite Strength & Conditioning Specialist (CSCS). Answer user's queries about their workout routine structure, progressive overload, and volume analysis.";

    set({ isAiLoading: true });
    try {
      return await chatCompletion(provider, systemInstruction, prompt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('MorphIQ Coach LLM Error:', msg);
      return `AI Coach Error: ${msg}`;
    } finally {
      set({ isAiLoading: false });
    }
  },

  loadFavorites: async () => {
    const profile = get().activeProfile;
    if (!profile?.id) {
      set({ favoriteExerciseIds: [] });
      return;
    }
    const favorites = await favoriteRepo.getAll(profile.id);
    set({ favoriteExerciseIds: favorites.map(f => f.exerciseId) });
  },

  toggleFavorite: async (exerciseId) => {
    const profile = get().activeProfile;
    if (!profile?.id) return;
    const ids = get().favoriteExerciseIds;
    if (ids.includes(exerciseId)) {
      await favoriteRepo.remove(profile.id, exerciseId);
      set({ favoriteExerciseIds: ids.filter(i => i !== exerciseId) });
    } else {
      await favoriteRepo.add({ profileId: profile.id, exerciseId, addedAt: new Date() });
      set({ favoriteExerciseIds: [...ids, exerciseId] });
    }
  },

  linkPendingRoutineToWorkout: async (workoutLogId) => {
    const profile = get().activeProfile;
    if (!profile) return;
    
    const pendingSets = await workoutSetRepo.getForWorkout('pending');
    if (pendingSets.length === 0) return;

    await workoutSetRepo.deleteForWorkout('pending');

    for (const s of pendingSets) {
      await workoutSetRepo.add({
        ...s,
        id: undefined,
        workoutLogId: workoutLogId,
      });
    }

    await get().loadSetsForWorkout(workoutLogId);
    set(state => ({
      activeWorkoutSets: {
        ...state.activeWorkoutSets,
        pending: []
      }
    }));
  },

  clearPendingRoutine: async () => {
    await workoutSetRepo.deleteForWorkout('pending');
    set(state => ({
      activeWorkoutSets: {
        ...state.activeWorkoutSets,
        pending: []
      }
    }));
  },

  importMeasurements: async (records) => {
    const profile = get().activeProfile;
    if (!profile) return;

    const existing = await measurementRepo.getAll(profile.id!);
    
    const toMinuteKey = (d: Date) => {
      const date = new Date(d);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
    };
    
    const existingKeys = new Set(existing.map(m => toMinuteKey(m.timestamp)));

    let addedCount = 0;
    for (const rec of records) {
      const key = toMinuteKey(rec.timestamp);
      if (existingKeys.has(key)) {
        console.log('MorphIQ Store: Skipping duplicate body composition measurement:', rec.timestamp);
        continue;
      }
      
      console.log('MorphIQ Store: Importing new measurement:', rec.timestamp);
      await measurementRepo.save({
        ...rec,
        profileId: profile.id!,
        timestamp: new Date(rec.timestamp),
      });
      addedCount++;
    }

    if (addedCount > 0) {
      const history = await measurementRepo.getAll(profile.id!);
      set({ measurements: history });
    }
  },

  analyzeWorkoutHistoryPeriod: async (period) => {
    const profile = get().activeProfile;
    if (!profile) return 'No active profile.';

    const end = new Date();
    const start = new Date();
    if (period === 'week') {
      start.setDate(start.getDate() - 7);
    } else if (period === 'month') {
      start.setDate(start.getDate() - 30);
    } else {
      start.setDate(start.getDate() - 365);
    }

    const workouts = await workoutRepo.getRange(profile.id!, start, end);
    const workoutsWithSets = await Promise.all(
      workouts.map(async (w) => {
        const sets = await workoutSetRepo.getForWorkout(w.id!);
        return { ...w, sets };
      })
    );

    let summary = `Workout History Report for the past ${period}:\n`;
    summary += `- Total Workout Sessions: ${workouts.length}\n`;
    
    const typeCounts: Record<string, number> = {};
    let totalMinutes = 0;
    let totalCalories = 0;
    
    workouts.forEach(w => {
      typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
      totalMinutes += w.duration;
      totalCalories += w.caloriesBurned || 0;
    });
    
    summary += `- Active Duration: ${(totalMinutes / 60).toFixed(1)} hours total\n`;
    summary += `- Calories Burned: ${totalCalories} kcal total\n`;
    summary += `- Workout Types breakdown:\n`;
    for (const [type, count] of Object.entries(typeCounts)) {
      summary += `  * ${type}: ${count} sessions\n`;
    }
    
    summary += `\nDetailed Exercises & Volume:\n`;
    const exerciseSummary: Record<string, {
      totalSets: number;
      maxWeight: number;
      repsCount: number;
      weightSum: number;
      strengthSetsCount: number;
      totalDistance: number;
      totalDuration: number;
      maxSpeed: number;
      cardioSetsCount: number;
    }> = {};
    
    workoutsWithSets.forEach(w => {
      w.sets.forEach(s => {
        if (!exerciseSummary[s.exerciseName]) {
          exerciseSummary[s.exerciseName] = {
            totalSets: 0,
            maxWeight: 0,
            repsCount: 0,
            weightSum: 0,
            strengthSetsCount: 0,
            totalDistance: 0,
            totalDuration: 0,
            maxSpeed: 0,
            cardioSetsCount: 0
          };
        }
        const data = exerciseSummary[s.exerciseName];
        data.totalSets++;
        if (s.weight !== undefined && s.weight !== null) {
          data.maxWeight = Math.max(data.maxWeight, s.weight);
          data.weightSum += s.weight;
          data.strengthSetsCount++;
        }
        if (s.reps !== undefined && s.reps !== null) {
          data.repsCount += s.reps;
        }
        if (s.distanceKm !== undefined && s.distanceKm !== null) {
          data.totalDistance += s.distanceKm;
          data.cardioSetsCount++;
        }
        if (s.duration !== undefined && s.duration !== null) {
          data.totalDuration += s.duration;
        }
        if (s.speed !== undefined && s.speed !== null) {
          data.maxSpeed = Math.max(data.maxSpeed, s.speed);
        }
      });
    });
    
    if (Object.keys(exerciseSummary).length === 0) {
      summary += `(No exercise sets logged in this timeframe. Make sure you log your sets inside Gym Session routines!)\n`;
    } else {
      for (const [exName, data] of Object.entries(exerciseSummary)) {
        if (data.strengthSetsCount > 0) {
          const avgWeight = data.weightSum / data.strengthSetsCount;
          const avgReps = data.repsCount / data.strengthSetsCount;
          summary += `- **${exName}** (Strength): ${data.totalSets} total sets. Max weight: ${data.maxWeight.toFixed(1)} kg/lbs, Avg weight: ${avgWeight.toFixed(1)} kg/lbs, Avg reps: ${avgReps.toFixed(1)}\n`;
        } else if (data.cardioSetsCount > 0) {
          const avgSpeed = data.maxSpeed > 0 ? `, Max speed: ${data.maxSpeed.toFixed(1)} km/h` : '';
          const totalDistStr = data.totalDistance > 0 ? `, Total distance: ${data.totalDistance.toFixed(2)} km` : '';
          const totalDurStr = data.totalDuration > 0 ? `, Total duration: ${data.totalDuration} mins` : '';
          summary += `- **${exName}** (Cardio): ${data.totalSets} total sets${totalDistStr}${totalDurStr}${avgSpeed}\n`;
        } else {
          summary += `- **${exName}**: ${data.totalSets} sets logged\n`;
        }
      }
    }

    const prompt = `You are a certified Strength and Conditioning Specialist (CSCS).
Analyze the user's training history for the past ${period}:

${summary}

Please provide a professional, periodized training report evaluating:
1. Consistency, training frequency, and workout type balance.
2. Volume distribution, muscle group balance (pull vs push, upper vs lower), and aerobic vs anaerobic conditioning split.
3. Progressive overload trend, potential plateaus, or overtraining warnings.
4. 2-3 concrete periodization recommendations for their next block.
Keep the tone professional, motivating, and science-grounded. Keep the response concise but highly actionable. Avoid boilerplate disclaimers.`;

    const provider = buildProviderFromEnv();
    const storeKey = get().apiKey;
    if (storeKey) provider.apiKey = storeKey;

    if (!provider.apiKey && !provider.baseUrl.includes('localhost')) {
      return 'No API key configured. Set VITE_LLM_API_KEY in your .env file to enable workout routine analysis.';
    }

    const systemInstruction = "You are MorphIQ, an elite Strength & Conditioning Specialist (CSCS). Answer user's queries about their workout routine structure, progressive overload, and volume analysis.";

    set({ isAiLoading: true });
    try {
      return await chatCompletion(provider, systemInstruction, prompt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('MorphIQ Coach LLM Error:', msg);
      return `Error generating history analysis: ${msg}`;
    } finally {
      set({ isAiLoading: false });
    }
  },

  scheduleMonthlyReminder: async () => {
    if (!Capacitor.isNativePlatform()) {
      localStorage.setItem('morphiq_monthly_reminder', 'true');
      return;
    }
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') {
          throw new Error('Notification permission denied');
        }
      }

      await LocalNotifications.cancel({ notifications: [{ id: 101 }] });

      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'MorphIQ Monthly Scan',
            body: 'Time for your monthly body composition scan! Take a measurement on your Samsung Health watch and sync.',
            id: 101,
            schedule: {
              every: 'month',
              on: { day: 1, hour: 9, minute: 0 }
            },
            sound: 'default'
          }
        ]
      });

      localStorage.setItem('morphiq_monthly_reminder', 'true');
      console.log('MorphIQ: Monthly scan reminder scheduled.');
    } catch (e) {
      console.error('Failed to schedule local notification:', e);
      throw e;
    }
  },

  cancelMonthlyReminder: async () => {
    localStorage.setItem('morphiq_monthly_reminder', 'false');
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: 101 }] });
      console.log('MorphIQ: Monthly scan reminder cancelled.');
    } catch (e) {
      console.error('Failed to cancel local notifications:', e);
    }
  },
}));
