import type { ICoachAgentService, AgentContext } from '../../core/interfaces/IAgent';
import { getAge } from '../../core/entities/UserProfile';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';

// ─── LLM Provider Config ───────────────────────────────────────────────────
export interface LLMProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com/v1',
  openai:   'https://api.openai.com/v1',
  groq:     'https://api.groq.com/openai/v1',
  ollama:   'http://localhost:11434/v1',
  together: 'https://api.together.xyz/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

export function buildProviderFromEnv(): LLMProviderConfig {
  const provider = (import.meta.env.VITE_LLM_PROVIDER as string | undefined) ?? 'deepseek';
  const model    = (import.meta.env.VITE_LLM_MODEL    as string | undefined) ?? 'deepseek-v4-flash';
  const apiKey   = (import.meta.env.VITE_LLM_API_KEY  as string | undefined) ?? '';

  const baseUrl =
    provider === 'custom'
      ? ((import.meta.env.VITE_LLM_BASE_URL as string | undefined) ?? '')
      : (PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS['deepseek']);

  return { baseUrl, model, apiKey };
}

// ─── OpenAI-Compatible Chat Completion ────────────────────────────────────
export async function chatCompletion(
  provider: LLMProviderConfig,
  systemPrompt: string,
  userPromptOrMessages: string | Array<{ role: string; content: string }>,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (!provider.apiKey && !provider.baseUrl.includes('localhost')) {
    throw new Error('No API key configured. Set VITE_LLM_API_KEY in your .env file.');
  }

  const messages = typeof userPromptOrMessages === 'string'
    ? [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPromptOrMessages },
      ]
    : [
        { role: 'system', content: systemPrompt },
        ...userPromptOrMessages,
      ];

  const requestBody = {
    model: provider.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens:  options.maxTokens  ?? 1000,
  };

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: { message?: string } }).error?.message ?? `HTTP error ${response.status}`);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) throw new Error('Empty response from LLM provider.');
  return answer.trim();
}

// ─── Coach Prompt Builder ─────────────────────────────────────────────────
function buildCoachPrompt(context: AgentContext, userMessage: string): string {
  const { profile, latestMeasurement, measurementHistory, recentFoodLogs, recentWorkoutLogs, recentWorkoutSets } = context;

  let prompt = `=== USER PROFILE ===
- Name: ${profile.name}
- Gender: ${profile.gender}
- Age: ${getAge(profile.birthDate)} years
- Height: ${profile.height} cm
${profile.targetWeight ? `- Target Weight: ${profile.targetWeight.toFixed(2)} kg\n` : ''}${profile.targetBodyFat ? `- Target Body Fat %: ${profile.targetBodyFat.toFixed(2)}%\n` : ''}

=== ATHLETE PROFILE & TRAINING SUMMARY ===
${profile.trainingProfile || 'No specific training profile summary or custom goals provided yet.'}

=== LATEST MEASUREMENT (Xiaomi Scale 2) ===
`;

  if (latestMeasurement) {
    prompt += `- Weight: ${latestMeasurement.weight.toFixed(2)} kg (BMI: ${latestMeasurement.bmi.toFixed(2)})
- Body Fat: ${latestMeasurement.bodyFat.toFixed(2)}% (Scale Rating)
- Muscle Mass: ${latestMeasurement.muscleMass.toFixed(2)} kg
- Bone Mass: ${latestMeasurement.boneMass.toFixed(2)} kg
- Water %: ${latestMeasurement.bodyWater.toFixed(2)}%
- Visceral Fat Index: ${latestMeasurement.visceralFat.toFixed(2)}
- BMR: ${latestMeasurement.bmr.toFixed(2)} kcal/day
- Metabolic Age: ${latestMeasurement.metabolicAge.toFixed(2)} years
- Protein: ${latestMeasurement.protein.toFixed(2)}%
- Body Type Index: ${latestMeasurement.bodyType}
`;
  } else {
    prompt += `No measurements logged yet. Prompt the user to step on their scale to sync their metrics.\n`;
  }

  if (measurementHistory.length > 1) {
    const oldest = measurementHistory[0];
    const latest = measurementHistory[measurementHistory.length - 1];
    const weightDiff = latest.weight - oldest.weight;
    const fatDiff    = latest.bodyFat - oldest.bodyFat;
    const muscleDiff = latest.muscleMass - oldest.muscleMass;
    prompt += `\n=== PROGRESS HISTORY (First to Last Measurement) ===
- Weight change: ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(2)} kg
- Body Fat change: ${fatDiff > 0 ? '+' : ''}${fatDiff.toFixed(2)}%
- Muscle Mass change: ${muscleDiff > 0 ? '+' : ''}${muscleDiff.toFixed(2)} kg
- Total measurements logged: ${measurementHistory.length}
`;
  }

  prompt += `\n=== DIET LOG (Recent meals) ===\n`;
  if (recentFoodLogs.length > 0) {
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    recentFoodLogs.forEach(f => {
      prompt += `- [${f.mealType.toUpperCase()}] ${f.description}: ${f.calories.toFixed(2)} kcal (P: ${f.protein.toFixed(2)}g, C: ${f.carbs.toFixed(2)}g, F: ${f.fat.toFixed(2)}g)\n`;
      totalCalories += f.calories;
      totalProtein  += f.protein;
      totalCarbs    += f.carbs;
      totalFat      += f.fat;
    });
    prompt += `- DAILY SUMMARY: ${totalCalories.toFixed(2)} kcal (Protein: ${totalProtein.toFixed(2)}g, Carbs: ${totalCarbs.toFixed(2)}g, Fat: ${totalFat.toFixed(2)}g)\n`;
  } else {
    prompt += `No food logged recently today.\n`;
  }

  prompt += `\n=== WORKOUT & ROUTINE HISTORY ===\n`;
  if (recentWorkoutLogs.length > 0) {
    const setsByWorkout: Record<string, WorkoutSet[]> = {};
    if (recentWorkoutSets) {
      recentWorkoutSets.forEach(s => {
        if (!setsByWorkout[s.workoutLogId]) {
          setsByWorkout[s.workoutLogId] = [];
        }
        setsByWorkout[s.workoutLogId].push(s);
      });
    }

    recentWorkoutLogs.forEach(w => {
      const dateStr = new Date(w.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      prompt += `- [${dateStr}] ${w.type} (${w.duration.toFixed(2)} min): ${w.description} ${w.caloriesBurned ? `[Burned: ${w.caloriesBurned.toFixed(2)} kcal]` : ''} [Source: ${w.source || 'manual'}]\n`;
      
      if (w.id && setsByWorkout[w.id] && setsByWorkout[w.id].length > 0) {
        const exercises: Record<string, WorkoutSet[]> = {};
        setsByWorkout[w.id].forEach(s => {
          if (!exercises[s.exerciseName]) {
            exercises[s.exerciseName] = [];
          }
          exercises[s.exerciseName].push(s);
        });

        Object.entries(exercises).forEach(([exName, exSets]) => {
          const setsStr = exSets.map(s => {
            let sStr = `Set ${s.setNumber}: `;
            if (s.weight != null && s.reps != null) {
              sStr += `${s.weight.toFixed(2)}kg/lbs x ${s.reps} reps`;
            } else if (s.distanceKm != null && s.duration != null) {
              sStr += `${s.distanceKm.toFixed(2)}km in ${s.duration} mins`;
              if (s.speed != null) sStr += ` @ ${s.speed} speed`;
            } else if (s.duration != null) {
              sStr += `${s.duration} mins`;
            } else {
              sStr += `completed`;
            }
            if (s.notes) sStr += ` (${s.notes})`;
            return sStr;
          }).join(', ');
          prompt += `  * ${exName}: ${setsStr}\n`;
        });
      }
    });
  } else {
    prompt += `No workouts logged recently.\n`;
  }

  prompt += `
=== CONVERSATION RULES ===
1. Keep responses highly personalized to the user's specific BIA metrics (inject reference stats like BMR, BMR limits, protein, and water).
2. Ground your advice in sports science (e.g., progressive overload, caloric deficits/surpluses, protein intake targets like 1.6-2.2g per kg of bodyweight).
3. Check the user's training goals and style (Athlete Profile & Training Summary) before answering. Tailor exercise recommendations, volume recommendations, and frequency to their goals.
4. If they ask about recipes or workouts, give clean bulleted routines or macro breakdowns.
5. Keep the tone encouraging, technical, yet directly actionable. Do not add general placeholders or boilerplate disclaimers at the end of every response.
`;

  if (userMessage) {
    prompt += `
=== USER MESSAGE ===
${userMessage}
`;
  }

  return prompt;
}

// ─── Coach Service Implementation ────────────────────────────────────────
const COACH_SYSTEM_PROMPT =
  "You are MorphIQ, a professional sports nutritionist and gym coach. Answer user's questions about their fitness and nutrition based on their body composition logs.";

export class MorphIQCoach implements ICoachAgentService {
  async generateResponse(context: AgentContext, userMessage: string, apiKey: string): Promise<string> {
    const provider = buildProviderFromEnv();
    if (apiKey) provider.apiKey = apiKey;

    if (!provider.apiKey && !provider.baseUrl.includes('localhost')) {
      return 'No API key configured. Set VITE_LLM_API_KEY in your .env file to enable AI Coaching.';
    }

    const coachPromptContext = buildCoachPrompt(context, '');
    const systemInstruction = `${COACH_SYSTEM_PROMPT}\n\n${coachPromptContext}`;

    const messages = context.chatHistory.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    if (messages.length === 0 || messages[messages.length - 1].content !== userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    try {
      return await chatCompletion(provider, systemInstruction, messages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('MorphIQ Coach LLM Error:', msg);
      return `AI Coach Error: ${msg}`;
    }
  }
}

export { MorphIQCoach as DeepSeekCoach };
