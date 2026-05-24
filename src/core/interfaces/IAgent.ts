import { UserProfile } from '../entities/UserProfile';
import { Measurement } from '../entities/Measurement';
import { FoodLog } from '../entities/FoodLog';
import { WorkoutLog } from '../entities/WorkoutLog';
import { Message } from '../entities/Message';

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
