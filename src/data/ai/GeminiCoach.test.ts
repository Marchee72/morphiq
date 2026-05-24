import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiCoach } from './GeminiCoach';
import { AgentContext } from '../../core/interfaces/IAgent';

describe('GeminiCoach', () => {
  const coach = new GeminiCoach();
  const mockContext: AgentContext = {
    profile: {
      name: 'Bruce Wayne',
      gender: 'male',
      age: 35,
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
      visceralFat: 6,
      metabolicAge: 28,
      protein: 21.0,
      bodyType: 5,
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
    expect(response).toContain('Please enter a valid Gemini API Key');
  });

  it('should format prompts correctly and call mock fetch', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Mocked response from AI Coach: Keep training hard!'
                  }
                ]
              }
            }
          ]
        })
      });
    });

    vi.stubGlobal('fetch', mockFetch);

    const response = await coach.generateResponse(mockContext, 'how is my weight?', 'test-api-key');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('key=test-api-key');
    
    // Verify prompt content was generated correctly
    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const promptText = requestBody.contents[0].parts[0].text;
    expect(promptText).toContain('Bruce Wayne');
    expect(promptText).toContain('Protein Shake');
    expect(promptText).toContain('Heavy squats');
    expect(promptText).toContain('how is my weight?');

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
