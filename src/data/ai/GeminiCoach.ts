import type { ICoachAgentService, AgentContext } from '../../core/interfaces/IAgent';
import { getAge } from '../../core/entities/UserProfile';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import { COACH_TOOLS, runCoachTool } from './coachTools';

export function parseRoutineFromMessage(content: string): RoutineTemplate | null {
  if (!content) return null;
  const routineJsonRegex = /```(?:json:routine|json)\s*\n?([\s\S]*?)\n?```/i;
  const match = content.match(routineJsonRegex);
  
  const jsonString = match
    ? match[1].trim()
    : (content.trim().startsWith('{') && content.trim().endsWith('}') ? content.trim() : '');

  if (!jsonString) return null;

  try {
    const data = JSON.parse(jsonString);
    if (data && typeof data === 'object' && Array.isArray(data.exercises) && data.exercises.length > 0) {
      return {
        id: data.id || undefined,
        profileId: data.profileId || '',
        title: data.title || 'Rutina Sugerida por Coach',
        description: data.description || '',
        targetMuscles: Array.isArray(data.targetMuscles) ? data.targetMuscles : [],
        exercises: data.exercises.map((ex: Record<string, unknown>) => ({
          exerciseId: String(ex.exerciseId || ex.id || ''),
          exerciseName: String(ex.exerciseName || ex.name || 'Ejercicio'),
          targetSets: Number(ex.targetSets || ex.sets || 3),
          targetReps: ex.targetReps != null ? Number(ex.targetReps) : undefined,
          // Left undefined rather than defaulted: no suggestion is a real
          // answer, and a fabricated load is worse than an empty dial.
          targetWeight: ex.targetWeight != null ? Number(ex.targetWeight) : undefined,
          notes: ex.notes ? String(ex.notes) : undefined,
        })),
        createdAt: data.createdAt ? new Date(data.createdAt as string) : new Date(),
      };
    }
  } catch {
    // Ignore JSON parse error
  }
  return null;
}



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

// ─── Tool Calling ─────────────────────────────────────────────────────────

/** One turn in an OpenAI-compatible exchange, including the tool roles. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** Enough rounds for "what did I do today, and how does it compare to last week". */
export const MAX_TOOL_ROUNDS = 4;

/** Providers word this differently; all we need to know is that tools are unsupported. */
function isToolsUnsupported(message: string): boolean {
  return /tool|function[_ ]call/i.test(message);
}

interface CompletionChoice {
  message?: { content?: string | null; tool_calls?: ToolCall[] };
  finish_reason?: string;
}

async function postChat(
  provider: LLMProviderConfig,
  body: Record<string, unknown>,
): Promise<CompletionChoice> {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: { message?: string } }).error?.message ?? `HTTP error ${response.status}`,
    );
  }

  const data = await response.json() as { choices?: CompletionChoice[] };
  const choice = data.choices?.[0];
  if (!choice) throw new Error('Empty response from LLM provider.');
  return choice;
}

/**
 * A chat completion the model can interrupt to go and look something up.
 *
 * Every tool result is fed back and the model asked again, up to `MAX_TOOL_ROUNDS`;
 * the last round is forced to answer so a model that keeps calling tools still
 * produces a reply rather than nothing. Tool failures come back as `{ error }`
 * instead of throwing — one unavailable query should cost a sentence, not the turn.
 *
 * Falls back to a plain completion when the provider rejects `tools` outright.
 * Support is not universal across the OpenAI-compatible endpoints this app can be
 * pointed at, and the coach has to keep working on the ones that lack it.
 */
export async function chatCompletionWithTools(
  provider: LLMProviderConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  tools: unknown[],
  execute: (name: string, args: Record<string, unknown>) => unknown,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  if (!provider.apiKey && !provider.baseUrl.includes('localhost')) {
    throw new Error('No API key configured. Set VITE_LLM_API_KEY in your .env file.');
  }

  const thread: ChatMessage[] = [{ role: 'system', content: systemPrompt }, ...messages];
  const base = {
    model: provider.model,
    temperature: options.temperature ?? 0.7,
    // Tool results are verbose and the answer still has to fit after them.
    max_tokens: options.maxTokens ?? 2000,
  };

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const last = round === MAX_TOOL_ROUNDS - 1;

    let choice: CompletionChoice;
    try {
      choice = await postChat(provider, {
        ...base,
        messages: thread,
        tools,
        // The final round must produce prose, whatever the model would prefer.
        tool_choice: last ? 'none' : 'auto',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (round === 0 && isToolsUnsupported(message)) {
        console.warn('MorphIQ Coach: provider rejected tools, falling back to a plain completion.', message);
        return await chatCompletion(provider, systemPrompt, messages.map(m => ({
          role: m.role,
          content: m.content ?? '',
        })), options);
      }
      throw err;
    }

    const calls = choice.message?.tool_calls ?? [];
    if (calls.length === 0) {
      const answer = choice.message?.content;
      if (!answer) throw new Error('Empty response from LLM provider.');
      return answer.trim();
    }

    thread.push({ role: 'assistant', content: choice.message?.content ?? null, tool_calls: calls });

    for (const call of calls) {
      let result: unknown;
      try {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        result = execute(call.function.name, args as Record<string, unknown>);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      thread.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  throw new Error('The coach kept looking things up without answering.');
}

// ─── Coach Prompt Builder ─────────────────────────────────────────────────
function buildCoachPrompt(context: AgentContext, userMessage: string): string {
  const { profile, latestMeasurement, measurementHistory, recentFoodLogs, recentWorkoutLogs, recentWorkoutSets } = context;
  const now = context.now ?? new Date();

  /**
   * The date anchor, first.
   *
   * Without it "how was my routine today" is unanswerable: workouts are printed
   * with a calendar date and the model has no way to know which of them is
   * today's. This was the whole reason the coach used to say it could not see
   * the user's routine.
   */
  let prompt = `=== NOW ===
- Current date and time: ${now.toLocaleString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })}
- Today's date in ISO form: ${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}
Resolve "today", "yesterday" and "this week" against this.

=== USER PROFILE ===
- Name: ${profile.name}
- Gender: ${profile.gender}
- Age: ${getAge(profile.birthDate)} years
- Height: ${profile.height} cm
${profile.targetWeight ? `- Target Weight: ${profile.targetWeight.toFixed(2)} kg\n` : ''}${profile.targetBodyFat ? `- Target Body Fat %: ${profile.targetBodyFat.toFixed(2)}%\n` : ''}

=== ATHLETE PROFILE & TRAINING SUMMARY ===
${profile.trainingProfile || 'No specific training profile summary or custom goals provided yet.'}

=== AVAILABLE GYM EQUIPMENT ===
${profile.availableEquipment && profile.availableEquipment.length > 0
    ? `Configured equipment: ${profile.availableEquipment.join(', ')}\nIMPORTANT: ONLY suggest exercises that use this equipment. Do NOT suggest exercises requiring equipment not listed.`
    : 'No equipment configured — all equipment types are available.'}

=== LATEST MEASUREMENT (Xiaomi Scale 2) ===
`;

  if (latestMeasurement) {
    prompt += `- Weight: ${latestMeasurement.weight.toFixed(2)} kg (BMI: ${latestMeasurement.bmi.toFixed(2)})
- Body Fat: ${latestMeasurement.bodyFat.toFixed(2)}% (Scale Rating)
- Muscle Mass: ${latestMeasurement.muscleMass.toFixed(2)} kg
- Bone Mass: ${latestMeasurement.boneMass.toFixed(2)} kg
- Water %: ${latestMeasurement.bodyWater.toFixed(2)}%
- BMR: ${latestMeasurement.bmr.toFixed(2)} kcal/day
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

  /**
   * The session in progress, which used to be invisible.
   *
   * It is not a `WorkoutLog` until the user presses finish, so asking about the
   * routine mid-session found nothing at all in the section above.
   */
  prompt += `\n=== SESSION IN PROGRESS ===\n`;
  if (context.activeSession) {
    const session = context.activeSession;
    const start = new Date(session.startTime);
    const elapsed = Math.max(0, Math.round((now.getTime() - start.getTime()) / 60_000));
    const logged = session.sets.filter(s => (s.reps ?? 0) > 0);

    prompt += `Started ${start.toLocaleTimeString()} (${elapsed} min ago) — ${session.workoutType}. `;
    prompt += `${logged.length} sets logged so far.\n`;
    for (const exercise of session.routineExercises ?? []) {
      const done = session.sets
        .filter(s => s.exerciseName === exercise.exerciseName && (s.reps ?? 0) > 0)
        .map(s => `${(s.weight ?? 0).toFixed(1)}kg x ${s.reps}`)
        .join(', ');
      prompt += `  * ${exercise.exerciseName} (target ${exercise.targetSets} sets): ${done || 'nothing logged yet'}\n`;
    }
  } else {
    prompt += `No session running right now.\n`;
  }

  prompt += `\n=== SAVED ROUTINES ===\n`;
  if (context.savedRoutines && context.savedRoutines.length > 0) {
    for (const routine of context.savedRoutines) {
      prompt += `- ${routine.title}: ${routine.exercises.map(e => `${e.exerciseName} ${e.targetSets}x${e.targetReps ?? '?'}`).join(', ')}\n`;
    }
  } else {
    prompt += `No saved routines.\n`;
  }

  prompt += `
=== CONVERSATION RULES ===
0. Everything above is the user's own logged data, read from their app. Answer from it. You also have tools to look up sessions, exercise progression, records, routines and scale readings on demand — call them rather than saying you cannot see the user's training.
1. BE HIGHLY CONCISE, DIRECT, AND CONCISE. Avoid long conversational preambles, repeated greetings, or verbose introductory fluff.
2. Keep responses personalized using exact user BIA metrics (BMR, body fat %, muscle mass, protein targets).
3. Ground all advice in sports science (progressive overload, 1.6-2.2g protein/kg, calorie targets).
4. STRICTLY FOCUS ON STRENGTH TRAINING & HYPERTROPHY. Do NOT generate or recommend HIIT, cardio, calisthenics, or endurance routines. ONLY generate weight and resistance strength routines.
5. Use clear markdown bullet points and short paragraphs for fast scanning.
6. When recommending a gym routine, write ONLY 1 brief introductory sentence in text. Do NOT write markdown tables or bulleted exercise lists in text. ALWAYS append a structured JSON routine code block using tag \`\`\`json:routine:
\`\`\`json:routine
{
  "title": "Nombre de la Rutina",
  "description": "Breve descripción",
  "targetMuscles": ["Chest", "Triceps"],
  "exercises": [
    { "exerciseId": "0025", "exerciseName": "barbell bench press", "targetSets": 4, "targetReps": 10, "targetWeight": 60, "notes": "Sobrecarga progresiva" }
  ]
}
\`\`\`
7. \`targetWeight\` is optional and in kg. Include it only when the user's own logged history supports a number; omit the field entirely rather than guessing. It is a starting suggestion the user overrides on the dial.
8. Do NOT add disclaimers, boilerplate summaries, or repeated sign-offs at the end.
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
  "You are MorphIQ, a concise, high-efficiency sports nutritionist and strength coach specialized exclusively in strength training, muscle hypertrophy, and weightlifting. Never recommend HIIT or calisthenics routines.";

export class MorphIQCoach implements ICoachAgentService {
  async generateResponse(context: AgentContext, userMessage: string, apiKey: string): Promise<string> {
    const provider = buildProviderFromEnv();
    if (apiKey) provider.apiKey = apiKey;

    if (!provider.apiKey && !provider.baseUrl.includes('localhost')) {
      return 'No API key configured. Set VITE_LLM_API_KEY in your .env file to enable AI Coaching.';
    }

    const coachPromptContext = buildCoachPrompt(context, '');
    const systemInstruction = `${COACH_SYSTEM_PROMPT}\n\n${coachPromptContext}`;

    const messages: ChatMessage[] = context.chatHistory.map(m => ({
      role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }));

    if (messages.length === 0 || messages[messages.length - 1].content !== userMessage) {
      messages.push({ role: 'user', content: userMessage });
    }

    try {
      // Without a data source there is nothing to look up, so the fixed prompt
      // above is all the model gets — the same behaviour as before tools existed.
      if (!context.dataSource) {
        return await chatCompletion(provider, systemInstruction, messages.map(m => ({
          role: m.role,
          content: m.content ?? '',
        })));
      }

      const source = context.dataSource;
      return await chatCompletionWithTools(
        provider,
        systemInstruction,
        messages,
        COACH_TOOLS,
        (name, args) => runCoachTool(name, args, source),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('MorphIQ Coach LLM Error:', msg);
      return `AI Coach Error: ${msg}`;
    }
  }
}

export { MorphIQCoach as DeepSeekCoach };
