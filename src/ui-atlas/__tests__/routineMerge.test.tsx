import { describe, expect, it, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { db } from '../../data/database/LocalDatabase';
import { renderScreen } from '../../test/renderScreen';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';

const initialState = useStore.getState();
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

const PUSH: Omit<RoutineTemplate, 'id'> = {
  profileId: 'p1',
  title: 'Empuje Coach',
  description: 'Pecho y hombro',
  targetMuscles: ['chest'],
  exercises: [
    { exerciseId: '0025', exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: 10 },
    { exerciseId: '0300', exerciseName: 'Overhead Press', targetSets: 3, targetReps: 8 },
  ],
  createdAt: new Date(2026, 6, 20),
};

/**
 * `AppDataProvider` calls `loadSavedRoutines()` on mount, which overwrites any
 * store override with whatever Dexie holds — so routines have to be seeded there.
 */
async function seedRoutine(routine: Omit<RoutineTemplate, 'id'> = PUSH) {
  await db.routineTemplates.add(routine as never);
}

/** The coach's routines live inside the chat log as a fenced json:routine block. */
function coachMessage(routine: Omit<RoutineTemplate, 'id'>) {
  return {
    id: 'm1',
    profileId: 'p1',
    sender: 'assistant' as const,
    content: ['Toma.', '```json:routine', JSON.stringify(routine), '```'].join('\n'),
    timestamp: new Date(2026, 6, 27, 10),
  };
}

const merged = () => useStore.getState().activeSession?.routineExercises ?? [];

describe('starting a session', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  it('goes straight into an empty session when there is nothing to choose between', async () => {
    // A sheet with one option in it is a tap tax, so it only appears when the
    // user actually has a routine saved or one waiting from the coach.
    renderScreen('today', { data: 'empty' });

    fireEvent.click(screen.getAllByRole('button', { name: /^(start|empezar|iniciar)$/i })[0]);

    await waitFor(() => expect(useStore.getState().activeSession).not.toBeNull());
    expect(document.querySelector('.at-sheet')).toBeNull();
  });

  it('offers the saved routines instead, and starts the one you pick', async () => {
    await seedRoutine();
    renderScreen('today', { data: 'empty' });

    await waitFor(() => expect(useStore.getState().savedRoutines).toHaveLength(1));
    fireEvent.click(screen.getAllByRole('button', { name: /^(start|empezar|iniciar)$/i })[0]);

    await waitFor(() => expect(document.querySelector('.at-sheet')).not.toBeNull());
    expect(text()).toMatch(/Empuje Coach/);
    expect(useStore.getState().activeSession).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Empuje Coach/ }));

    await waitFor(() => {
      expect(merged().map(e => e.exerciseName))
        .toEqual(['Barbell Bench Press', 'Overhead Press']);
    });
    // Started from a saved template, not from the coach's card.
    expect(useStore.getState().activeSession?.routineSource).toBe('template');
  });

  it('surfaces the coach\'s latest routine even when nothing is saved yet', async () => {
    renderScreen('today', { data: 'empty', overrides: { chatHistory: [coachMessage(PUSH)] } });

    fireEvent.click(screen.getAllByRole('button', { name: /^(start|empezar|iniciar)$/i })[0]);

    await waitFor(() => expect(document.querySelector('.at-sheet')).not.toBeNull());
    expect(text()).toMatch(/Empuje Coach/);
  });
});

describe('bringing a routine into a running session', () => {
  beforeEach(async () => {
    useStore.setState(initialState, true);
    await Promise.all(db.tables.map(t => t.clear()));
  });

  const liveSession = {
    workoutType: 'Pierna',
    exercises: [
      { id: 'e1', exerciseName: 'Back Squat', targetSets: 3 },
      { id: 'e2', exerciseName: 'Leg Curl', targetSets: 3 },
    ],
    sets: [{ exerciseName: 'Back Squat', setNumber: 1, weight: 100, reps: 5, isCompleted: true }],
  };

  const openMerge = () => {
    renderScreen('coach', {
      data: 'rich',
      session: liveSession,
      overrides: { chatHistory: [coachMessage(PUSH)] },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /start routine|iniciar rutina/i })[0]);
  };

  it('asks instead of replacing the session, which used to eat every logged set', async () => {
    openMerge();

    await waitFor(() => expect(document.querySelector('.at-sheet')).not.toBeNull());
    const session = useStore.getState().activeSession;
    expect(session?.workoutType).toBe('Pierna');
    expect(session?.sets).toHaveLength(1);
    expect(session?.routineExercises).toHaveLength(2);
  });

  it('appends the routine after what is already there', async () => {
    openMerge();
    await waitFor(() => expect(document.querySelector('.at-sheet')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /add 2 exercises|anadir 2 ejercicios/i }));

    await waitFor(() => {
      expect(merged().map(e => e.exerciseName))
        .toEqual(['Back Squat', 'Leg Curl', 'Barbell Bench Press', 'Overhead Press']);
    });
    expect(useStore.getState().activeSession?.sets).toHaveLength(1);
  });

  it('replaces only the pending half, so the logged exercise survives', async () => {
    openMerge();
    await waitFor(() => expect(document.querySelector('.at-sheet')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /replace what is pending|reemplazar lo pendiente/i }));

    await waitFor(() => {
      expect(merged().map(e => e.exerciseName))
        .toEqual(['Back Squat', 'Barbell Bench Press', 'Overhead Press']);
    });
    // Leg Curl was a plan nobody had touched; Back Squat was work already done.
    expect(useStore.getState().activeSession?.sets.map(s => s.exerciseName)).toEqual(['Back Squat']);
  });

  it('warns about exercises already in the session and does not duplicate them', async () => {
    renderScreen('coach', {
      data: 'rich',
      session: {
        workoutType: 'Empuje',
        exercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 3 }],
        sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 5, isCompleted: true }],
      },
      overrides: { chatHistory: [coachMessage(PUSH)] },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /start routine|iniciar rutina/i })[0]);

    await waitFor(() => expect(document.querySelector('.at-sheet')).not.toBeNull());
    expect(text()).toMatch(/1 of these is already|1 de estos ya esta/i);

    fireEvent.click(screen.getByRole('button', { name: /add 1 exercise|anadir 1 ejercicio/i }));

    await waitFor(() => {
      // Sets are keyed by exercise name, so a second Bench Press row would share
      // the first one's sets.
      expect(merged().map(e => e.exerciseName)).toEqual(['Barbell Bench Press', 'Overhead Press']);
    });
  });
});
