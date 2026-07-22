import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WeeklyGoalCard } from '../WeeklyGoalCard';
import { SleepRecoveryCard } from '../SleepRecoveryCard';
import { BodyGoalProgressCard } from '../BodyGoalProgressCard';

import type { WorkoutLog } from '../../../core/entities/WorkoutLog';
import type { Measurement } from '../../../core/entities/Measurement';

describe('Weekly Goal & Sleep Recovery Components', () => {
  it('renders WeeklyGoalCard with 7-day pills and workout stats', () => {
    const mockWorkouts: WorkoutLog[] = [
      { id: '1', profileId: 'p1', timestamp: new Date(), type: 'Strength', duration: 45, description: 'Gym session', caloriesBurned: 350 },
    ];
    render(<WeeklyGoalCard workoutLogs={mockWorkouts} weeklyGoalDays={4} />);

    expect(screen.getByText(/weekly target/i)).toBeInTheDocument();
    expect(screen.getByText(/1 of 4 workout days/i)).toBeInTheDocument();
    expect(screen.getByText(/active time/i)).toBeInTheDocument();
  });

  it('renders SleepRecoveryCard with sleep index score and stages', () => {
    render(<SleepRecoveryCard sleepHours={7.67} sleepScore={84} />);

    expect(screen.getByText(/sleep & recovery/i)).toBeInTheDocument();
    expect(screen.getByText(/7h 40m · Sleep Index/i)).toBeInTheDocument();
    expect(screen.getByText(/84 \/ 100/i)).toBeInTheDocument();
    expect(screen.getByText(/deep/i)).toBeInTheDocument();
  });

  it('renders BodyGoalProgressCard with target weight and body fat trajectory', () => {
    const mockMeasurements: Measurement[] = [
      { id: 'm1', profileId: 'p1', timestamp: new Date('2026-07-01'), weight: 80.0, impedance: 500, bmi: 24, bmr: 1800, bodyFat: 20.0, bodyWater: 55, boneMass: 3.5, muscleMass: 65, visceralFat: 4, metabolicAge: 28, protein: 18, bodyType: 2 },
      { id: 'm2', profileId: 'p1', timestamp: new Date('2026-07-22'), weight: 78.4, impedance: 500, bmi: 23.5, bmr: 1800, bodyFat: 18.5, bodyWater: 56, boneMass: 3.5, muscleMass: 65, visceralFat: 4, metabolicAge: 28, protein: 18, bodyType: 2 },
    ];
    render(
      <BodyGoalProgressCard
        measurements={mockMeasurements}
        targetWeightKg={74.0}
        targetBodyFatPct={15.0}
      />
    );

    expect(screen.getByText(/body composition target/i)).toBeInTheDocument();
    expect(screen.getByText(/target: 74 kg · 15% fat/i)).toBeInTheDocument();
    expect(screen.getByText(/4.4 kg left/i)).toBeInTheDocument();
  });
});
