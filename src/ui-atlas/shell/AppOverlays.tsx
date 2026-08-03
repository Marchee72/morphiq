import React, { useState } from 'react';
import { useStore } from '../../presentation/state/store';
import { useAppUi, useAppActions } from '../data/useAppData';
import { AtlasSettings } from '../atlas/AtlasSettings';
import { AtlasAddFoodSheet } from '../atlas/AtlasAddFoodSheet';
import { AtlasLogWeightSheet } from '../atlas/AtlasLogWeightSheet';
import { AtlasDayNoteSheet } from '../atlas/AtlasDayNoteSheet';
import { AtlasExercisePicker } from '../atlas/AtlasExercisePicker';
import { AtlasExerciseDetail } from '../atlas/AtlasExerciseDetail';
import { AtlasSessionSummary } from '../atlas/AtlasSessionSummary';
import { AtlasHistory } from '../atlas/AtlasHistory';
import { AtlasSessionDetail } from '../atlas/AtlasSessionDetail';
import { AtlasStartSheet } from '../atlas/AtlasStartSheet';
import { AtlasRoutineMergeSheet } from '../atlas/AtlasRoutineMergeSheet';
import type { Exercise } from '../../core/entities/Exercise';
import type { FeelingId } from '../types';

/**
 * Sheets and full-screen overlays, mounted inside the app wrapper so they share
 * its palette and sit above the scrolling body.
 */
export const AppOverlays: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { overlay, payload } = useAppUi();
  const actions = useAppActions();

  const addFoodLog = useStore(s => s.addFoodLog);
  const activeSession = useStore(s => s.activeSession);
  const addActiveSessionExercise = useStore(s => s.addActiveSessionExercise);
  const swapActiveSessionExercise = useStore(s => s.swapActiveSessionExercise);
  const updateActiveSessionNote = useStore(s => s.updateActiveSessionNote);

  const [detail, setDetail] = useState<Exercise | null>(null);
  // Local rather than an overlay id of its own: the session sheet opens *over*
  // the history panel, and the shell's single overlay slot cannot hold both.
  const [sessionId, setSessionId] = useState<string | null>(null);

  // The picker serves two intents. Which one is decided by the row that opened
  // it, which is nowhere near here — hence the payload.
  const pickExercise = (exercise: { id?: string; name: string }) => {
    if (payload.swapIndex != null) swapActiveSessionExercise(payload.swapIndex, exercise);
    else addActiveSessionExercise(exercise);
    onClose();
    /**
     * Choosing an exercise is the end of the errand, so it ends on the exercise.
     *
     * Closing the picker only uncovers whatever was underneath it, which is the
     * screen you left — and mid-session that meant searching for a lift, picking
     * it, and being put back in a list instead of in front of it.
     */
    if (activeSession) actions.navigate('train');
  };

  return (
    <div className="app-overlays">
      {overlay === 'settings' && <AtlasSettings onClose={onClose} />}

      <AtlasAddFoodSheet
        open={overlay === 'addFood'}
        onClose={onClose}
        onSubmit={entry => { addFoodLog(entry); onClose(); }}
      />

      <AtlasLogWeightSheet
        open={overlay === 'logWeight'}
        onClose={onClose}
        onSubmit={kg => { actions.logWeight(kg); onClose(); }}
      />

      <AtlasExercisePicker
        open={overlay === 'exercisePicker'}
        swapping={payload.swapIndex != null}
        onClose={onClose}
        onSelect={pickExercise}
        onPreview={setDetail}
      />

      <AtlasDayNoteSheet
        open={overlay === 'dayNote'}
        onClose={onClose}
        initialFeeling={activeSession?.feelingTag as FeelingId | undefined}
        initialNotes={activeSession?.bodyNotes}
        onSave={(feeling, notes) => { updateActiveSessionNote(feeling, notes); onClose(); }}
      />

      <AtlasStartSheet open={overlay === 'startSession'} onClose={onClose} />

      <AtlasRoutineMergeSheet
        open={overlay === 'routineMerge'}
        routine={payload.routine}
        onClose={onClose}
      />

      <AtlasHistory
        open={overlay === 'history'}
        onClose={onClose}
        onOpenSession={setSessionId}
      />

      <AtlasSessionDetail
        workoutLogId={sessionId}
        onClose={() => setSessionId(null)}
        onOpenExercise={setDetail}
      />

      <AtlasExerciseDetail exercise={detail} onClose={() => setDetail(null)} />

      {/* Not keyed to `overlay`: it opens off the back of a finished session, and
          must survive that session ceasing to exist. */}
      <AtlasSessionSummary />
    </div>
  );
};
