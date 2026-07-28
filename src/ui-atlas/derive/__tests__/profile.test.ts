import { describe, expect, it } from 'vitest';
import type { UserProfile } from '../../../core/entities/UserProfile';
import { buildProfile, daypart, goalProgress } from '../profile';
import { DEFAULT_WEEKLY_GOAL_DAYS } from '../streak';

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  name: '  Marc  ', gender: 'male', birthDate: new Date(1990, 0, 1), height: 178,
  createdAt: new Date(2020, 0, 1), ...over,
});

describe('buildProfile', () => {
  it('trims the name and carries targets through', () => {
    const vm = buildProfile(profile({ targetWeight: 74, weeklyWorkoutGoalDays: 5 }));
    expect(vm.name).toBe('Marc');
    expect(vm.targetWeightKg).toBe(74);
    expect(vm.weeklyGoalDays).toBe(5);
  });

  it('defaults the weekly goal when unset', () => {
    expect(buildProfile(profile()).weeklyGoalDays).toBe(DEFAULT_WEEKLY_GOAL_DAYS);
  });

  it('survives a null profile during first load', () => {
    expect(buildProfile(null)).toMatchObject({ name: '', age: 0, targetWeightKg: null });
  });
});

describe('daypart', () => {
  it('splits the day for the greeting', () => {
    expect(daypart(new Date(2026, 6, 27, 8))).toBe('morning');
    expect(daypart(new Date(2026, 6, 27, 14))).toBe('afternoon');
    expect(daypart(new Date(2026, 6, 27, 21))).toBe('evening');
  });

  it('puts noon in the afternoon', () => {
    expect(daypart(new Date(2026, 6, 27, 12))).toBe('afternoon');
  });
});

describe('goalProgress', () => {
  it('measures the distance already covered toward the target', () => {
    expect(goalProgress(84, 79, 74)).toBe(50);
  });

  it('works for a target above the starting weight', () => {
    expect(goalProgress(70, 75, 80)).toBe(50);
  });

  it('clamps past the target rather than exceeding 100', () => {
    expect(goalProgress(84, 70, 74)).toBe(100);
  });

  it('clamps at zero when moving the wrong way', () => {
    expect(goalProgress(84, 88, 74)).toBe(0);
  });

  it('is null without a target', () => {
    expect(goalProgress(84, 79, null)).toBeNull();
  });

  it('reports complete when start and target are the same', () => {
    expect(goalProgress(74, 74, 74)).toBe(100);
  });
});
