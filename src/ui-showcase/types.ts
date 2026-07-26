export type ThemeId = 
  | 'clay-indigo'
  | 'warm-latte'
  | 'dark-stealth'
  | 'tactile-amber'
  | 'swiss-brutalist'
  | 'neumorphic-slate'
  | 'list-first'
  | 'gamified'
  | 'retro'
  | 'bento-grid';

export type ScreenId = 'main' | 'exercises' | 'gym' | 'coach' | 'add_exercise';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  sampleImage: string;
  tagline: string;
  bg: string;
  cardBg: string;
  accent: string;
  textColor: string;
  structuralPrinciple: string;
}

export interface ExerciseItem {
  id: string;
  name: string;
  category: string;
  muscle: string;
  equipment: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface WorkoutSet {
  id: string;
  setNum: number;
  weightKg: number;
  reps: number;
  completed: boolean;
}

export interface ActiveExercise {
  id: string;
  name: string;
  muscle: string;
  sets: WorkoutSet[];
}
