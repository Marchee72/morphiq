import type { UserProfile } from '../entities/UserProfile';
import type { Measurement } from '../entities/Measurement';
import type { FoodLog } from '../entities/FoodLog';
import type { WorkoutLog } from '../entities/WorkoutLog';
import type { Message } from '../entities/Message';
import type { WorkoutSet } from '../entities/WorkoutSet';
import type { RoutineTemplate } from '../entities/RoutineTemplate';
import type { ActiveSessionSnapshot, CoachDataSource } from '../../data/ai/coachTools';

export interface AgentContext {
  profile: UserProfile;
  latestMeasurement?: Measurement;
  measurementHistory: Measurement[];
  recentFoodLogs: FoodLog[];
  recentWorkoutLogs: WorkoutLog[];
  chatHistory: Message[];
  recentWorkoutSets?: WorkoutSet[];
  /**
   * The clock the answer is relative to. Without it the model cannot resolve
   * "today" against the dates in the prompt, which is what made the coach say it
   * could not see the user's routine.
   */
  now?: Date;
  /** The session being trained right now — not yet a `WorkoutLog`, so invisible without this. */
  activeSession?: ActiveSessionSnapshot | null;
  savedRoutines?: RoutineTemplate[];
  /** Lets the model look up what the fixed prompt above does not carry. */
  dataSource?: CoachDataSource;
}

export interface ICoachAgentService {
  generateResponse(context: AgentContext, userMessage: string, apiKey: string): Promise<string>;
}
