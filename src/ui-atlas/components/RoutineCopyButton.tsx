import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useT } from '../../i18n';
import { copyRoutineToClipboard, type ExportableRoutine } from '../derive/routineText';

/**
 * Puts a routine on the clipboard as plain text.
 *
 * Shared by the three places a routine is shown — the coach's card, the saved
 * list, and one a buddy sent — because the confirmation tick is local state and
 * three copies of it is three chances for one to keep saying "copied" forever.
 *
 * Says nothing on failure. The clipboard API is simply absent over plain HTTP
 * and in some WebViews, and an error toast about it would be noise the user can
 * do nothing with; the button just does not tick.
 */
export const RoutineCopyButton: React.FC<{
  routine: ExportableRoutine;
  className?: string;
}> = ({ routine, className = 'at-btn' }) => {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!(await copyRoutineToClipboard(routine))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      className={className}
      data-ghost="true"
      onClick={() => void copy()}
      aria-label={t('routine.copy')}
      title={t('routine.copy')}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
};
