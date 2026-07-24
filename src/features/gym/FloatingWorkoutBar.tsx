import React, { useEffect } from 'react';
import { useStore } from '../../presentation/state/store';
import { showActiveWorkoutNotification, cancelActiveWorkoutNotification } from '../../data/health/ActiveWorkoutNotification';

export const FloatingWorkoutBar: React.FC = () => {
  const { activeSession } = useStore();

  // Sync Android Lock Screen & Status Bar Live Notification ONCE on session or set count change
  useEffect(() => {
    if (!activeSession) {
      cancelActiveWorkoutNotification();
      return;
    }

    const startMs = activeSession.startTime ? new Date(activeSession.startTime).getTime() : Date.now();
    const initialSecs = Math.max(0, Math.floor((new Date().getTime() - startMs) / 1000));
    const m = Math.floor(initialSecs / 60);
    const s = initialSecs % 60;
    const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    showActiveWorkoutNotification(timeStr, activeSession.sets.length, activeSession.startTime);
  }, [activeSession, activeSession?.sets.length]);

  // Floating workout bar UI is removed per prompt request (active session handled via Native System Live Notification)
  return null;
};
