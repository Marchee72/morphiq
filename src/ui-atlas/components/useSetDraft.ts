import { useState } from 'react';
import type { SessionSetVM } from '../types';

export interface SetDraft {
  weight: number;
  reps: number;
  setWeight: (next: number | ((prev: number) => number)) => void;
  setReps: (next: number | ((prev: number) => number)) => void;
}

/**
 * The weight/reps a Train screen is currently editing.
 *
 * Re-seeds whenever the cursor moves to a different set. The concept's steppers
 * initialised from literals once and never updated, so changing set left the
 * previous set's numbers on screen while the "last time" line moved.
 *
 * Reset happens *during render* rather than in an effect: React documents this
 * as the way to derive state from props, and doing it in an effect renders one
 * frame with stale numbers and triggers a cascading re-render.
 */
export function useSetDraft(key: string, set: SessionSetVM | undefined): SetDraft {
  const seedWeight = set?.weightKg || set?.lastWeightKg || 0;
  const seedReps = set?.reps || set?.lastReps || 10;

  const [seenKey, setSeenKey] = useState(key);
  const [weight, setWeight] = useState(seedWeight);
  const [reps, setReps] = useState(seedReps);

  if (seenKey !== key) {
    setSeenKey(key);
    setWeight(seedWeight);
    setReps(seedReps);
  }

  return { weight, reps, setWeight, setReps };
}
