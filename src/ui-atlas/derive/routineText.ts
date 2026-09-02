/**
 * A routine as plain text, for pasting anywhere.
 *
 * Sharing inside the app is buddy-to-buddy and needs both people to have an
 * account and a link. This is the escape hatch: a WhatsApp message, a note, a
 * gym forum. It is deliberately one-way — there is no parser to read it back,
 * because the round trip is what would make the format load-bearing.
 *
 * Numbers appear only when the routine actually prescribes them. Reps default
 * to 10 and weight to nothing on the cards elsewhere in the app, and exporting
 * those made-up figures would turn a suggestion into an instruction.
 */

interface ExportableExercise {
  exerciseName: string;
  targetSets: number;
  targetReps?: number;
  targetWeight?: number;
  notes?: string;
}

export interface ExportableRoutine {
  title: string;
  description?: string;
  exercises: ExportableExercise[];
}

/** '4 × 10 @ 60 kg', trimmed back to whatever the routine actually says. */
function prescription(exercise: ExportableExercise): string {
  const sets = exercise.targetReps != null
    ? `${exercise.targetSets} × ${exercise.targetReps}`
    : `${exercise.targetSets} sets`;
  return exercise.targetWeight != null ? `${sets} @ ${exercise.targetWeight} kg` : sets;
}

export function routineToText(routine: ExportableRoutine): string {
  const lines = [routine.title];
  if (routine.description) lines.push(routine.description);
  lines.push('');
  for (const exercise of routine.exercises) {
    const note = exercise.notes ? ` (${exercise.notes})` : '';
    lines.push(`${exercise.exerciseName} — ${prescription(exercise)}${note}`);
  }
  return lines.join('\n');
}

/**
 * Puts the routine on the clipboard, reporting whether it landed.
 *
 * Guarded the way `AtlasBuddyInvite` guards its own clipboard call: the API is
 * absent over plain HTTP and in some WebViews, and a rejected promise there
 * would otherwise surface as an unhandled rejection rather than a quiet no.
 */
export async function copyRoutineToClipboard(routine: ExportableRoutine): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(routineToText(routine));
    return true;
  } catch {
    return false;
  }
}
