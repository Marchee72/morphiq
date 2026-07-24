import { registerPlugin, Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface ActiveWorkoutPluginInterface {
  startWorkout(options: { title: string; startTimeMs: number; setsCount: number }): Promise<void>;
  updateWorkout(options: { title: string; startTimeMs: number; setsCount: number }): Promise<void>;
  stopWorkout(): Promise<void>;
}

const NativeActiveWorkout = registerPlugin<ActiveWorkoutPluginInterface>('ActiveWorkout');

/**
 * Show an ongoing workout notification with a chronometer timer and set count.
 * No media controls, no progress bar — just a clean stopwatch notification.
 */
export async function showActiveWorkoutNotification(timeStr: string, setsCount: number, startTimeDate?: Date | string) {
  const startTimeMs = startTimeDate ? new Date(startTimeDate).getTime() : Date.now();

  if (Capacitor.isNativePlatform()) {
    try {
      await NativeActiveWorkout.startWorkout({
        title: 'Strength Training',
        startTimeMs,
        setsCount,
      });
      return;
    } catch (err) {
      console.warn('Native ActiveWorkout plugin start failed, falling back to LocalNotifications:', err);
    }
  }

  // Web fallback: simple local notification (no MediaSession — avoids media controls)
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9001,
          channelId: 'active_workout_channel_v5',
          title: 'Strength Training',
          body: `${setsCount} sets logged · ${timeStr}`,
          ongoing: true,
          autoCancel: false,
          smallIcon: 'ic_launcher',
          iconColor: '#0381fe',
          schedule: { at: new Date(Date.now() + 20) },
        },
      ],
    });
  } catch (err) {
    console.error('Failed to schedule local notification fallback:', err);
  }
}

export async function cancelActiveWorkoutNotification() {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeActiveWorkout.stopWorkout();
      return;
    } catch (err) {
      console.warn('Native ActiveWorkout plugin stop failed:', err);
    }
  }

  try {
    await LocalNotifications.cancel({ notifications: [{ id: 9001 }] });
  } catch (err) {
    console.error('Failed to cancel local notification fallback:', err);
  }
}