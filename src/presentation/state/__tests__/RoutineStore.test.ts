import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';
import { db } from '../../../data/database/LocalDatabase';

describe('Zustand Store — Routine Integration', () => {
  beforeEach(async () => {
    await db.userProfiles.clear();
    await db.routineTemplates.clear();
    useStore.setState({
      profiles: [],
      activeProfile: null,
      savedRoutines: [],
      activeSession: null,
      isGymModeOpen: false,
    });

    // Create active profile
    const profileId = await useStore.getState().createProfile({
      name: 'Test Athlete',
      gender: 'male',
      birthDate: new Date('1995-05-15'),
      height: 180,
    });
    await useStore.getState().setActiveProfile(profileId);
  });

  it('should start an active session pre-loaded with routine exercises', () => {
    const routine = {
      title: 'Torso Fuerza',
      description: 'Rutina recomendada por Coach',
      targetMuscles: ['Chest', 'Triceps'],
      exercises: [
        { exerciseId: '0025', exerciseName: 'Bench Press', targetSets: 4, targetReps: 10 },
        { exerciseId: '0239', exerciseName: 'Incline Dumbbell Press', targetSets: 3, targetReps: 12 },
      ],
    };

    useStore.getState().startActiveSessionWithRoutine(routine);

    const state = useStore.getState();
    expect(state.isGymModeOpen).toBe(true);
    expect(state.activeTab).toBe('train');
    expect(state.activeSession).not.toBeNull();
    expect(state.activeSession?.workoutType).toBe('Torso Fuerza');
    expect(state.activeSession?.routineExercises).toHaveLength(2);
    expect(state.activeSession?.routineExercises?.[0].exerciseName).toBe('Bench Press');
  });

  it('should reorder routine exercises in active session', () => {
    const routine = {
      title: 'Routine Reorder Test',
      exercises: [
        { exerciseId: '0001', exerciseName: 'Exercise 1', targetSets: 3 },
        { exerciseId: '0002', exerciseName: 'Exercise 2', targetSets: 3 },
        { exerciseId: '0003', exerciseName: 'Exercise 3', targetSets: 3 },
      ],
    };

    useStore.getState().startActiveSessionWithRoutine(routine);

    // Reorder Exercise 1 (from index 0 to index 2)
    useStore.getState().reorderActiveSessionExercises(0, 2);

    const exercises = useStore.getState().activeSession?.routineExercises;
    expect(exercises?.[0].exerciseName).toBe('Exercise 2');
    expect(exercises?.[1].exerciseName).toBe('Exercise 3');
    expect(exercises?.[2].exerciseName).toBe('Exercise 1');
  });

  it('should swap a routine exercise while preserving target sets and reps', () => {
    const routine = {
      title: 'Routine Swap Test',
      exercises: [
        { exerciseId: '0001', exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: 10 },
      ],
    };

    useStore.getState().startActiveSessionWithRoutine(routine);

    // Swap exercise 0 with Dumbbell Flyes
    useStore.getState().swapActiveSessionExercise(0, { id: '0099', name: 'Dumbbell Flyes' });

    const ex = useStore.getState().activeSession?.routineExercises?.[0];
    expect(ex?.exerciseId).toBe('0099');
    expect(ex?.exerciseName).toBe('Dumbbell Flyes');
    expect(ex?.targetSets).toBe(4);
    expect(ex?.targetReps).toBe(10);
  });

  it('should remove a routine exercise from active session', () => {
    const routine = {
      title: 'Routine Delete Test',
      exercises: [
        { exerciseId: '0001', exerciseName: 'Exercise 1', targetSets: 3 },
        { exerciseId: '0002', exerciseName: 'Exercise 2', targetSets: 3 },
      ],
    };

    useStore.getState().startActiveSessionWithRoutine(routine);

    useStore.getState().removeActiveSessionExercise(0);

    const exercises = useStore.getState().activeSession?.routineExercises;
    expect(exercises).toHaveLength(1);
    expect(exercises?.[0].exerciseName).toBe('Exercise 2');
  });

  it('should save and delete routine templates in database', async () => {
    const routineData = {
      title: 'Saved Hypertrophy Routine',
      description: 'Test Description',
      targetMuscles: ['Back', 'Biceps'],
      exercises: [
        { exerciseId: '0005', exerciseName: 'Lat Pulldown', targetSets: 4, targetReps: 12 },
      ],
    };

    const id = await useStore.getState().saveRoutineTemplate(routineData);
    expect(id).toBeDefined();

    let saved = useStore.getState().savedRoutines;
    expect(saved).toHaveLength(1);
    expect(saved[0].title).toBe('Saved Hypertrophy Routine');

    await useStore.getState().deleteRoutineTemplate(id);
    saved = useStore.getState().savedRoutines;
    expect(saved).toHaveLength(0);
  });
});
