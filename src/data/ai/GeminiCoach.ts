import type { ICoachAgentService, AgentContext } from '../../core/interfaces/IAgent';

export class GeminiCoach implements ICoachAgentService {
  private formatPrompt(context: AgentContext, userMessage: string): string {
    const { profile, latestMeasurement, measurementHistory, recentFoodLogs, recentWorkoutLogs } = context;

    let prompt = `You are MorphIQ, an elite double-certified Sports Nutritionist (CISSN) and Strength & Conditioning Specialist (CSCS). 
Your goal is to act as a highly professional personal trainer and dietitian for the user. 
Analyze their body composition metrics, diet logs, and exercise history, then answer their questions with precise, actionable, and scientific advice.

=== USER PROFILE ===
- Name: ${profile.name}
- Gender: ${profile.gender}
- Age: ${profile.age} years
- Height: ${profile.height} cm
${profile.targetWeight ? `- Target Weight: ${profile.targetWeight} kg\n` : ''}${profile.targetBodyFat ? `- Target Body Fat %: ${profile.targetBodyFat}%\n` : ''}
=== LATEST MEASUREMENT (Xiaomi Scale 2) ===
`;

    if (latestMeasurement) {
      prompt += `- Weight: ${latestMeasurement.weight.toFixed(1)} kg (BMI: ${latestMeasurement.bmi.toFixed(1)})
- Body Fat: ${latestMeasurement.bodyFat.toFixed(1)}% (Scale Rating)
- Muscle Mass: ${latestMeasurement.muscleMass.toFixed(1)} kg
- Bone Mass: ${latestMeasurement.boneMass.toFixed(2)} kg
- Water %: ${latestMeasurement.bodyWater.toFixed(1)}%
- Visceral Fat Index: ${latestMeasurement.visceralFat}
- BMR: ${latestMeasurement.bmr.toFixed(0)} kcal/day
- Metabolic Age: ${latestMeasurement.metabolicAge} years
- Protein: ${latestMeasurement.protein.toFixed(1)}%
- Body Type Index: ${latestMeasurement.bodyType}
`;
    } else {
      prompt += `No measurements logged yet. Prompt the user to step on their scale to sync their metrics.\n`;
    }

    if (measurementHistory.length > 1) {
      const oldest = measurementHistory[0];
      const latest = measurementHistory[measurementHistory.length - 1];
      const weightDiff = latest.weight - oldest.weight;
      const fatDiff = latest.bodyFat - oldest.bodyFat;
      const muscleDiff = latest.muscleMass - oldest.muscleMass;
      
      prompt += `\n=== PROGRESS HISTORY (First to Last Measurement) ===
- Weight change: ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)} kg
- Body Fat change: ${fatDiff > 0 ? '+' : ''}${fatDiff.toFixed(1)}%
- Muscle Mass change: ${muscleDiff > 0 ? '+' : ''}${muscleDiff.toFixed(1)} kg
- Total measurements logged: ${measurementHistory.length}
`;
    }

    prompt += `\n=== DIET LOG (Recent meals) ===\n`;
    if (recentFoodLogs.length > 0) {
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      recentFoodLogs.forEach(f => {
        prompt += `- [${f.mealType.toUpperCase()}] ${f.description}: ${f.calories} kcal (P: ${f.protein}g, C: ${f.carbs}g, F: ${f.fat}g)\n`;
        totalCalories += f.calories;
        totalProtein += f.protein;
        totalCarbs += f.carbs;
        totalFat += f.fat;
      });

      prompt += `- DAILY SUMMARY: ${totalCalories} kcal (Protein: ${totalProtein}g, Carbs: ${totalCarbs}g, Fat: ${totalFat}g)\n`;
    } else {
      prompt += `No food logged recently today.\n`;
    }

    prompt += `\n=== WORKOUT LOG (Recent exercises) ===\n`;
    if (recentWorkoutLogs.length > 0) {
      recentWorkoutLogs.forEach(w => {
        prompt += `- ${w.type} (${w.duration} min): ${w.description} ${w.caloriesBurned ? `[Burned: ${w.caloriesBurned} kcal]` : ''}\n`;
      });
    } else {
      prompt += `No workouts logged recently today.\n`;
    }

    prompt += `
=== CONVERSATION RULES ===
1. Keep responses highly personalized to the user's specific BIA metrics (inject reference stats like BMR, BMR limits, protein, and water).
2. Ground your advice in sports science (e.g., progressive overload, caloric deficits/surpluses, protein intake targets like 1.6-2.2g per kg of bodyweight).
3. If they ask about recipes or workouts, give clean bulleted routines or macro breakdowns.
4. Keep the tone encouraging, technical, yet directly actionable. Do not add general placeholders or boilerplate disclaimers at the end of every response.

=== USER MESSAGE ===
${userMessage}
`;

    return prompt;
  }

  async generateResponse(context: AgentContext, userMessage: string, apiKey: string): Promise<string> {
    if (!apiKey) {
      return 'Please enter a valid Gemini API Key in the settings panel to enable AI Coaching features.';
    }

    const prompt = this.formatPrompt(context, userMessage);
    const systemInstruction = "You are MorphIQ, a professional sports nutritionist and gym coach. Answer user's questions about their fitness and nutrition based on their body composition logs.";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: systemInstruction
          }
        ]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP error ${response.status}`);
      }

      const responseData = await response.json();
      const answer = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!answer) {
        throw new Error('Empty response from Gemini API.');
      }

      return answer.trim();
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      return `AI Coach Error: ${err.message || 'Failed to generate response. Please check your network connection and API key.'}`;
    }
  }
}
