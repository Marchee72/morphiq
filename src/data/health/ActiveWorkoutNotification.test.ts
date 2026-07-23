import { describe, it, expect, vi, beforeEach } from 'vitest';
import { showActiveWorkoutNotification, cancelActiveWorkoutNotification } from './ActiveWorkoutNotification';
import { LocalNotifications } from '@capacitor/local-notifications';

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    schedule: vi.fn().mockResolvedValue({}),
    cancel: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
  },
  registerPlugin: vi.fn().mockReturnValue({
    startWorkout: vi.fn().mockResolvedValue(undefined),
    updateWorkout: vi.fn().mockResolvedValue(undefined),
    stopWorkout: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('ActiveWorkoutNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules a local notification fallback with timer and sets count', async () => {
    await showActiveWorkoutNotification('05:30', 3, new Date());

    expect(LocalNotifications.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: [
          expect.objectContaining({
            id: 9001,
            title: 'Strength Training',
            ongoing: true,
          }),
        ],
      })
    );
  });

  it('cancels the local notification on cancelActiveWorkoutNotification', async () => {
    await cancelActiveWorkoutNotification();

    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 9001 }] });
  });
});