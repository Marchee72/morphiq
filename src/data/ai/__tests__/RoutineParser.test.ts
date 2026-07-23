import { describe, it, expect } from 'vitest';
import { parseRoutineFromMessage } from '../GeminiCoach';

describe('RoutineParser', () => {
  it('should return null for non-routine text content', () => {
    const result = parseRoutineFromMessage('Debes consumir 150g de proteína diariamente y descansar adecuadamente.');
    expect(result).toBeNull();
  });

  it('should parse valid json:routine codeblock from AI response', () => {
    const aiText = `Aquí tienes tu rutina recomendada para hoy:

\`\`\`json:routine
{
  "title": "Rutina Torso Fuerza",
  "description": "Fuerza de pecho y tríceps con mancuernas",
  "targetMuscles": ["Chest", "Triceps"],
  "exercises": [
    { "exerciseId": "0025", "exerciseName": "Barbell Bench Press", "targetSets": 4, "targetReps": 10, "notes": "RPE 8" },
    { "exerciseId": "0239", "exerciseName": "Incline Dumbbell Press", "targetSets": 3, "targetReps": 12 }
  ]
}
\`\`\`

¡Buena suerte en el gimnasio!`;

    const parsed = parseRoutineFromMessage(aiText);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe('Rutina Torso Fuerza');
    expect(parsed?.targetMuscles).toEqual(['Chest', 'Triceps']);
    expect(parsed?.exercises).toHaveLength(2);
    expect(parsed?.exercises[0].exerciseId).toBe('0025');
    expect(parsed?.exercises[0].exerciseName).toBe('Barbell Bench Press');
    expect(parsed?.exercises[0].targetSets).toBe(4);
    expect(parsed?.exercises[0].targetReps).toBe(10);
  });

  it('should parse raw json object string if format is plain JSON', () => {
    const jsonStr = JSON.stringify({
      title: "Leg Day",
      description: "Cuádriceps y femorales",
      targetMuscles: ["Quads", "Hamstrings"],
      exercises: [
        { exerciseId: "0030", exerciseName: "Barbell Squat", targetSets: 4, targetReps: 8 }
      ]
    });

    const parsed = parseRoutineFromMessage(jsonStr);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe('Leg Day');
    expect(parsed?.exercises[0].exerciseName).toBe('Barbell Squat');
  });
});
