import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ActiveWorkoutBanner } from '../ActiveWorkoutBanner';
import { useStore } from '../../../presentation/state/store';

describe('ActiveWorkoutBanner', () => {
  beforeEach(() => {
    useStore.setState({
      activeSession: null,
      isGymModeOpen: false,
      activeTab: 'home',
    });
  });

  it('renders nothing when activeSession is null', () => {
    const { container } = render(<ActiveWorkoutBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when activeSession is in progress', () => {
    useStore.setState({
      activeSession: {
        startTime: new Date(),
        workoutType: 'Strength Training',
        sets: [
          { exerciseName: 'Bench Press', setNumber: 1, weight: 80, reps: 10 },
          { exerciseName: 'Bench Press', setNumber: 2, weight: 85, reps: 8 },
        ],
      },
    });

    render(<ActiveWorkoutBanner />);
    expect(screen.getByText('Entrenamiento en curso')).toBeInTheDocument();
    expect(screen.getByText('Strength Training')).toBeInTheDocument();
    expect(screen.getByText(/2 series/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.480 kg/i)).toBeInTheDocument();
  });

  it('opens tracker when Continuar button is clicked', () => {
    useStore.setState({
      activeSession: {
        startTime: new Date(),
        workoutType: 'Strength Training',
        sets: [],
      },
    });

    render(<ActiveWorkoutBanner />);
    const continueBtn = screen.getByRole('button', { name: /continuar/i });
    fireEvent.click(continueBtn);
    expect(useStore.getState().isGymModeOpen).toBe(true);
  });

  it('switches to gym tab when Ir a Gym button is clicked', () => {
    useStore.setState({
      activeSession: {
        startTime: new Date(),
        workoutType: 'Strength Training',
        sets: [],
      },
    });

    render(<ActiveWorkoutBanner />);
    const gymBtn = screen.getByRole('button', { name: /ir a gym tab/i });
    fireEvent.click(gymBtn);
    expect(useStore.getState().activeTab).toBe('gym');
  });
});
