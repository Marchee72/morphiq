import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GymScreen } from '../GymScreen';
import { LiveWorkoutScreen } from '../LiveWorkoutScreen';
import { WorkoutHistoryCard } from '../WorkoutHistoryCard';
import { useStore } from '../../../presentation/state/store';
import type { WorkoutLog } from '../../../core/entities/WorkoutLog';

const mockProfile = {
  id: 'profile_1',
  name: 'Alex',
  gender: 'male' as const,
  birthDate: new Date('1995-06-15'),
  height: 178,
  createdAt: new Date(),
};

const mockLog: WorkoutLog = {
  id: 'log_1',
  profileId: 'profile_1',
  timestamp: new Date('2026-07-21T10:00:00Z'),
  type: 'Strength Training',
  duration: 45,
  description: 'Chest & Triceps',
  caloriesBurned: 320,
  source: 'manual',
};

describe('Gym Feature Components', () => {
  beforeEach(() => {
    useStore.setState({
      activeProfile: mockProfile,
      workoutHistory: [mockLog],
      activeWorkoutSets: {
        log_1: [
          {
            id: 'set_1',
            workoutLogId: 'log_1',
            profileId: 'profile_1',
            exerciseName: 'bench press',
            setNumber: 1,
            weight: 80,
            reps: 8,
            notes: 'felt light',
            timestamp: new Date(),
          },
        ],
      },
    });
  });

  it('renders GymScreen with start workout button, weekly stats and history card', () => {
    render(<GymScreen />);
    expect(screen.getByText('Gym')).toBeInTheDocument();
    expect(screen.getByText(/fuerza/i)).toBeInTheDocument();
    expect(screen.getByText(/listo para entrenar\?/i)).toBeInTheDocument();
  });

  it('renders WorkoutHistoryCard with sets accordion', () => {
    const sets = useStore.getState().activeWorkoutSets['log_1'];
    render(<WorkoutHistoryCard log={mockLog} sets={sets} />);

    expect(screen.getByText('Strength Training')).toBeInTheDocument();
    expect(screen.getByText('1 sets logged')).toBeInTheDocument();

    fireEvent.click(screen.getByText('1 sets logged'));
    expect(screen.getByText('bench press')).toBeInTheDocument();
    expect(screen.getByText('80 kg')).toBeInTheDocument();
  });

  it('opens and closes LiveWorkoutScreen tracker', () => {
    const handleClose = vi.fn();
    render(<LiveWorkoutScreen isOpen={true} onClose={handleClose} />);

    expect(screen.getByText('Strength Training')).toBeInTheDocument();
    expect(screen.getByText(/Finalizar Sesión|Finish Session/i)).toBeInTheDocument();
  });
});
