import type { UserProfile } from '../entities/UserProfile';
import type { Measurement } from '../entities/Measurement';
import type { FoodLog } from '../entities/FoodLog';
import type { WorkoutLog } from '../entities/WorkoutLog';
import type { Message } from '../entities/Message';

export interface AgentContext {
  profile: UserProfile;
  latestMeasurement?: Measurement;
  measurementHistory: Measurement[];
  recentFoodLogs: FoodLog[];
  recentWorkoutLogs: WorkoutLog[];
  chatHistory: Message[];
}

export interface ICoachAgentService {
  generateResponse(context: AgentContext, userMessage: string, apiKey: string): Promise<string>;
}
