import React from 'react';
import { useT } from '../../i18n';
import { CopyConfirm } from '../kit/copy-confirm';
import { copyRoutineToClipboard, type ExportableRoutine } from '../derive/routineText';

/**
 * Puts a routine on the clipboard as plain text.
 *
 * Shared by the three places a routine is shown — the coach's card, the saved
 * list, and one a buddy sent — because the confirmation is local state and
 * three copies of it is three chances for one to keep saying "copied" forever.
 * The confirmation itself (`CopyConfirm`) says nothing on failure.
 */
export const RoutineCopyButton: React.FC<{
  routine: ExportableRoutine;
  className?: string;
  showLabel?: boolean;
}> = ({ routine, className, showLabel }) => {
  const { t } = useT();
  return (
    <CopyConfirm
      onCopy={() => copyRoutineToClipboard(routine)}
      label={t('routine.copy')}
      copiedLabel={t('routine.copied')}
      className={className}
      showLabel={showLabel}
    />
  );
};
