import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '../store';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';

/**
 * Keeping the screen in step with a queue draining underneath it.
 *
 * A workout logged offline is rendered under a placeholder id. When the server
 * finally answers with the real one, every slice holding the placeholder has to
 * follow in the same tick — a reload would be a visible flicker, and a partial
 * swap would leave sets pointing at a workout nothing is filed under.
 */

const workout = (id: string) => ({
  id, profileId: '1', type: 'strength', timestamp: new Date(), duration: 45,
  description: '3 sets', source: 'manual' as const,
});

const set = (id: string, workoutLogId: string): WorkoutSet => ({
  id, workoutLogId, profileId: '1', exerciseName: 'Squat',
  setNumber: 1, reps: 5, weight: 100, timestamp: new Date(),
});

beforeEach(() => {
  useStore.setState({
    measurements: [], foodLogs: [], workoutLogs: [], workoutHistory: [],
    chatHistory: [], savedRoutines: [], wellnessLogs: [], allSets: [],
    activeWorkoutSets: {}, resolvedIds: {},
  });
});

describe('rewriteId', () => {
  it('swaps the workout id everywhere it is held', async () => {
    useStore.setState({
      workoutLogs: [workout('tmp_A'), workout('7')],
      workoutHistory: [workout('tmp_A')],
    });

    useStore.getState().rewriteId('tmp_A', '42');

    const state = useStore.getState();
    expect(state.workoutLogs.map(w => w.id)).toEqual(['42', '7']);
    expect(state.workoutHistory.map(w => w.id)).toEqual(['42']);
  });

  it('makes the sets follow the workout they point at', async () => {
    useStore.setState({
      allSets: [set('s1', 'tmp_A'), set('s2', 'tmp_A'), set('s3', '7')],
    });

    useStore.getState().rewriteId('tmp_A', '42');

    // Left behind, these would name a workout nothing in the store is filed
    // under, and the session screen would come up empty.
    expect(useStore.getState().allSets.map(s => s.workoutLogId)).toEqual(['42', '42', '7']);
  });

  it('rebuilds the activeWorkoutSets keys, which are workout ids', async () => {
    useStore.setState({
      activeWorkoutSets: { tmp_A: [set('s1', 'tmp_A')], '7': [set('s3', '7')] },
    });

    useStore.getState().rewriteId('tmp_A', '42');

    const map = useStore.getState().activeWorkoutSets;
    expect(Object.keys(map).sort()).toEqual(['42', '7']);
    expect(map['42'][0].workoutLogId).toBe('42');
    expect(map.tmp_A).toBeUndefined();
  });

  it('leaves everything else exactly as it was', async () => {
    const untouched = [workout('7'), workout('8')];
    useStore.setState({ workoutLogs: untouched });

    useStore.getState().rewriteId('tmp_A', '42');

    expect(useStore.getState().workoutLogs.map(w => w.id)).toEqual(['7', '8']);
  });

  it('remembers the swap so a component holding the old id can still resolve it', async () => {
    /**
     * A session sheet opened offline keeps the workout id it was handed in its
     * own state. Without this map it would ask for `tmp_A`, find nothing, and
     * go blank the moment the sync completed.
     */
    useStore.getState().rewriteId('tmp_A', '42');
    expect(useStore.getState().resolveId('tmp_A')).toBe('42');
  });

  it('follows a chain of rewrites rather than stopping at the first hop', async () => {
    useStore.getState().rewriteId('tmp_A', 'tmp_B');
    useStore.getState().rewriteId('tmp_B', '42');
    expect(useStore.getState().resolveId('tmp_A')).toBe('42');
  });

  it('hands back an id it knows nothing about, unchanged', async () => {
    expect(useStore.getState().resolveId('7')).toBe('7');
  });

  it('does not spin on a map that points at itself', async () => {
    // Bounded rather than trusted: a corrupt map must degrade, not hang the app.
    useStore.setState({ resolvedIds: { a: 'b', b: 'a' } });
    expect(() => useStore.getState().resolveId('a')).not.toThrow();
  });
});
