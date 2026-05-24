import { create } from 'zustand';
import type { UserProfile } from '../../core/entities/UserProfile';
import type { Measurement } from '../../core/entities/Measurement';
import type { FoodLog } from '../../core/entities/FoodLog';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { Message } from '../../core/entities/Message';
import {
  UserProfileRepository,
  MeasurementRepository,
  FoodLogRepository,
  WorkoutLogRepository,
  MessageRepository,
} from '../../data/database/LocalDatabase';
import { WebBluetoothScaleAdapter, MockScaleAdapter } from '../../data/bluetooth/WebBluetoothScale';
import { GeminiCoach } from '../../data/ai/GeminiCoach';
import { BiaCalculator } from '../../data/calculation/BiaCalculator';

// Repository instances
const profileRepo = new UserProfileRepository();
const measurementRepo = new MeasurementRepository();
const foodRepo = new FoodLogRepository();
const workoutRepo = new WorkoutLogRepository();
const messageRepo = new MessageRepository();

// Bluetooth adapters
const bleAdapter = new WebBluetoothScaleAdapter();
const mockAdapter = new MockScaleAdapter();

// AI Coach adapter
const aiCoach = new GeminiCoach();

interface StoreState {
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  measurements: Measurement[];
  foodLogs: FoodLog[];
  workoutLogs: WorkoutLog[];
  chatHistory: Message[];
  
  // Scale scanning state
  isScanning: boolean;
  scaleError: string | null;
  scaleWeight: number;
  scaleImpedance: number;
  scaleStabilized: boolean;
  scaleImpedancePresent: boolean;

  // Configuration
  selectedDate: Date;
  isSimulator: boolean;
  apiKey: string;
  isAiLoading: boolean;

  // Actions
  loadProfiles: () => Promise<void>;
  setActiveProfile: (id: string) => Promise<void>;
  createProfile: (profile: Omit<UserProfile, 'createdAt'>) => Promise<string>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  
  addMeasurementFromScale: () => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
  
  addFoodLog: (log: Omit<FoodLog, 'profileId' | 'timestamp'>) => Promise<void>;
  deleteFoodLog: (id: string) => Promise<void>;
  
  addWorkoutLog: (log: Omit<WorkoutLog, 'profileId' | 'timestamp'>) => Promise<void>;
  deleteWorkoutLog: (id: string) => Promise<void>;
  
  sendChatMessage: (content: string) => Promise<void>;
  clearChat: () => Promise<void>;
  
  startScaleScan: () => Promise<void>;
  stopScaleScan: () => Promise<void>;
  setSimulator: (active: boolean) => void;
  setApiKey: (key: string) => void;
  setSelectedDate: (date: Date) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  profiles: [],
  activeProfile: null,
  measurements: [],
  foodLogs: [],
  workoutLogs: [],
  chatHistory: [],
  
  isScanning: false,
  scaleError: null,
  scaleWeight: 0,
  scaleImpedance: 0,
  scaleStabilized: false,
  scaleImpedancePresent: false,

  selectedDate: new Date(),
  isSimulator: true, // Default to simulator mode for easier user testing
  apiKey: localStorage.getItem('morphiq_api_key') || '',
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
      set({ activeProfile: null, measurements: [], foodLogs: [], workoutLogs: [], chatHistory: [] });
    }
  },

  setActiveProfile: async (id: string) => {
    const profile = await profileRepo.get(id);
    if (profile) {
      set({ activeProfile: profile });
      const history = await measurementRepo.getAll(id);
      const foods = await foodRepo.getAll(id, get().selectedDate);
      const workouts = await workoutRepo.getAll(id, get().selectedDate);
      const chat = await messageRepo.getAll(id);
      set({
        measurements: history,
        foodLogs: foods,
        workoutLogs: workouts,
        chatHistory: chat,
      });
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

  addMeasurementFromScale: async () => {
    const profile = get().activeProfile;
    if (!profile) return;
    const weight = get().scaleWeight;
    const impedance = get().scaleImpedance;
    
    // Calculate all BIA metrics
    const measurement = BiaCalculator.calculateAll(
      profile.id!,
      weight,
      profile.height,
      profile.age,
      profile.gender,
      impedance > 0 ? impedance : 500 // fallback if no impedance measured
    );

    await measurementRepo.save(measurement);
    
    // Refresh history
    const history = await measurementRepo.getAll(profile.id!);
    set({ measurements: history });

    // Stop scanning
    get().stopScaleScan();
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
    if (!profile) return;
    await workoutRepo.add({
      ...workoutData,
      profileId: profile.id!,
      timestamp: get().selectedDate,
    });
    const workouts = await workoutRepo.getAll(profile.id!, get().selectedDate);
    set({ workoutLogs: workouts });
  },

  deleteWorkoutLog: async (id) => {
    await workoutRepo.delete(id);
    const profile = get().activeProfile;
    if (profile) {
      const workouts = await workoutRepo.getAll(profile.id!, get().selectedDate);
      set({ workoutLogs: workouts });
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
      const workouts = get().workoutLogs;

      const context = {
        profile,
        latestMeasurement: latest,
        measurementHistory: history,
        recentFoodLogs: foods,
        recentWorkoutLogs: workouts,
        chatHistory: get().chatHistory,
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
    } catch (err: any) {
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

  startScaleScan: async () => {
    set({ isScanning: true, scaleError: null, scaleWeight: 0, scaleImpedance: 0, scaleStabilized: false, scaleImpedancePresent: false });
    const adapter = get().isSimulator ? mockAdapter : bleAdapter;

    try {
      await adapter.startScanning(
        (data) => {
          set({
            scaleWeight: data.weight,
            scaleImpedance: data.impedance,
            scaleStabilized: data.stabilized,
            scaleImpedancePresent: data.impedancePresent,
          });

          // Once scale completes measurement and impedance is present, save it automatically
          if (data.stabilized && data.impedancePresent) {
            get().addMeasurementFromScale();
          }
        },
        (err) => {
          set({ scaleError: err.message || 'Bluetooth connection failed.', isScanning: false });
        }
      );
    } catch (err: any) {
      set({ scaleError: err.message || 'Failed to start Bluetooth.', isScanning: false });
    }
  },

  stopScaleScan: async () => {
    const adapter = get().isSimulator ? mockAdapter : bleAdapter;
    await adapter.stopScanning();
    set({ isScanning: false });
  },

  setSimulator: (active) => {
    get().stopScaleScan();
    set({ isSimulator: active });
  },

  setApiKey: (key) => {
    localStorage.setItem('morphiq_api_key', key);
    set({ apiKey: key });
  },

  setSelectedDate: async (date) => {
    set({ selectedDate: date });
    const profile = get().activeProfile;
    if (profile) {
      const foods = await foodRepo.getAll(profile.id!, date);
      const workouts = await workoutRepo.getAll(profile.id!, date);
      set({ foodLogs: foods, workoutLogs: workouts });
    }
  },
}));
