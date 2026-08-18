import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepSeekCoach } from './GeminiCoach';
import type { AgentContext } from '../../core/interfaces/IAgent';

describe('DeepSeekCoach', () => {
  const coach = new DeepSeekCoach();
  const mockContext: AgentContext = {
    profile: {
      name: 'Bruce Wayne',
      gender: 'male',
      birthDate: new Date('1991-05-24'),
      height: 188,
      targetWeight: 95,
      createdAt: new Date(),
    },
    latestMeasurement: {
      profileId: '1',
      timestamp: new Date(),
      weight: 95.5,
      impedance: 480,
      bmi: 27.0,
      bmr: 1950,
      bodyFat: 12.0,
      bodyWater: 60.5,
      boneMass: 3.8,
      muscleMass: 80.0,
      },
    measurementHistory: [],
    recentFoodLogs: [
      {
        profileId: '1',
        timestamp: new Date(),
        mealType: 'breakfast',
        description: 'Protein Shake',
        calories: 300,
        protein: 40,
        carbs: 10,
        fat: 3,
      }
    ],
    recentWorkoutLogs: [
      {
        profileId: '1',
        timestamp: new Date(),
        type: 'Strength',
        duration: 60,
        description: 'Heavy squats',
      }
    ],
    chatHistory: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return API key warning if key is empty', async () => {
    const response = await coach.generateResponse(mockContext, 'hello', '');
    expect(response).toContain('No API key configured. Set VITE_LLM_API_KEY');
  });

  it('should format prompts correctly and call mock fetch', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [
            {
              message: {
                content: 'Mocked response from AI Coach: Keep training hard!'
              }
            }
          ]
        })
      });
    });

    vi.stubGlobal('fetch', mockFetch);

    const response = await coach.generateResponse(mockContext, 'how is my weight?', 'test-api-key');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-api-key');
    
    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.model).toBe('deepseek-v4-flash');
    
    const systemPromptText = requestBody.messages[0].content;
    expect(systemPromptText).toContain('Bruce Wayne');
    expect(systemPromptText).toContain('Protein Shake');
    expect(systemPromptText).toContain('Heavy squats');
    expect(systemPromptText).toContain('MorphIQ');

    const userPromptText = requestBody.messages[1].content;
    expect(userPromptText).toContain('how is my weight?');

    expect(response).toBe('Mocked response from AI Coach: Keep training hard!');
  });

  it('should return error message if fetch fails', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          error: {
            message: 'Internal server error'
          }
        })
      });
    });

    vi.stubGlobal('fetch', mockFetch);

    const response = await coach.generateResponse(mockContext, 'hello', 'test-api-key');
    expect(response).toContain('AI Coach Error: Internal server error');
  });
});
