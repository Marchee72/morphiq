import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Exercise } from '../../../core/entities/Exercise';
import { ExerciseCard } from '../ExerciseCard';
import { ExerciseDetailScreen } from '../ExerciseDetailScreen';
import { ExercisePickerSheet } from '../ExercisePickerSheet';
import { ExerciseLibraryScreen } from '../ExerciseLibraryScreen';

const mockExercise: Exercise = {
  id: '0025',
  name: 'barbell bench press',
  category: 'chest',
  equipment: 'barbell',
  target: 'pectorals',
  muscleGroup: 'chest',
  secondaryMuscles: ['triceps', 'deltoids'],
  instructionSteps: [
    'Lie back on a flat bench.',
    'Grasp the bar with a medium-width grip.',
    'Lower the bar to your mid-chest.',
  ],
  image: 'images/0025.jpg',
  gifUrl: 'videos/0025.gif',
  attribution: '© Gym visual — gymvisual.com',
};

vi.mock('../../../data/exercises/ExerciseCatalog', () => {
  const dummyCatalog = {
    size: 1,
    search: () => [mockExercise],
    getById: () => mockExercise,
    getMany: () => [mockExercise],
    facets: () => ({ categories: ['chest'], equipment: ['barbell'] }),
  };
  return {
    ExerciseCatalog: vi.fn().mockImplementation(() => dummyCatalog),
    getExerciseCatalog: vi.fn().mockResolvedValue(dummyCatalog),
  };
});

describe('ExerciseCard', () => {
  it('renders exercise name, target, and equipment', () => {
    const onFav = vi.fn();
    const onClick = vi.fn();
    render(
      <ExerciseCard
        exercise={mockExercise}
        isFavorite={false}
        onToggleFavorite={onFav}
        onClick={onClick}
      />
    );
    expect(screen.getByText('barbell bench press')).toBeInTheDocument();
    expect(screen.getByText('pectorals')).toBeInTheDocument();
    expect(screen.getByText('barbell')).toBeInTheDocument();
  });

  it('triggers onToggleFavorite when heart icon clicked', () => {
    const onFav = vi.fn();
    const onClick = vi.fn();
    render(
      <ExerciseCard
        exercise={mockExercise}
        isFavorite={false}
        onToggleFavorite={onFav}
        onClick={onClick}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /add barbell bench press to favorites/i }));
    expect(onFav).toHaveBeenCalled();
  });
});

describe('ExerciseDetailScreen', () => {
  it('renders exercise instructions and attribution when open', async () => {
    render(
      <ExerciseDetailScreen
        exercise={mockExercise}
        isOpen={true}
        isFavorite={true}
        onClose={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    );
    expect(screen.getByText('barbell bench press')).toBeInTheDocument();
    expect(screen.getByText('Lie back on a flat bench.')).toBeInTheDocument();
    expect(screen.getByText(/gym visual/i)).toBeInTheDocument();
  });
});

describe('ExercisePickerSheet', () => {
  it('renders search input and matching exercises when open', async () => {
    render(
      <ExercisePickerSheet
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search 1,300\+ exercises/i)).toBeInTheDocument();
    });
  });
});

describe('ExerciseLibraryScreen', () => {
  it('renders Exercises header and search bar', async () => {
    render(<ExerciseLibraryScreen />);
    await waitFor(() => {
      expect(screen.getByText('Exercises')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search exercises/i)).toBeInTheDocument();
    });
  });
});
