import React from 'react';
import { X } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData } from '../data/useAppData';
import { useExerciseSearch } from '../data/useExerciseSearch';
import { useDismissOnBack } from '../components/useDismissOnBack';
import type { CatalogItemVM } from '../types';
import type { Exercise } from '../../core/entities/Exercise';
import { AtlasExerciseBrowser } from './AtlasExerciseBrowser';

/**
 * Add an exercise to the running session.
 *
 * The search itself is `AtlasExerciseBrowser`, shared with the Find tab; this
 * adds the heading and the way out, and makes choosing an exercise mean adding it.
 */
export const AtlasExercisePicker: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: { id?: string; name: string }) => void;
  /** Replacing an exercise rather than adding one — changes the heading only. */
  swapping?: boolean;
  /** Opens the detail sheet without leaving the picker. */
  onPreview?: (exercise: Exercise) => void;
}> = ({ open, onClose, swapping = false, onSelect, onPreview }) => {
  const { t } = useT();
  const { catalog } = useAppData();
  const search = useExerciseSearch();

  // The picker stays mounted between openings, so its search would otherwise
  // greet the next exercise with the last one's query — and hide the shelf.
  const close = () => { search.clear(); onClose(); };
  useDismissOnBack(open, close, 'picker');

  if (!open) return null;

  const pick = (item: CatalogItemVM) => { search.clear(); onSelect({ id: item.id, name: item.name }); };
  const preview = onPreview && ((item: CatalogItemVM) => {
    const exercise = catalog.byId(item.id);
    if (exercise) onPreview(exercise);
  });

  return (
    <div className="at-picker" role="dialog" aria-label={t('picker.title')}>
      <div className="at-editor-head">
        <div>
          <small>{swapping ? t('picker.swapSubtitle') : t('picker.subtitle')}</small>
          <h3 className="at-serif">{swapping ? t('train.swap') : t('picker.title')}</h3>
        </div>
        <button className="at-round" onClick={close} aria-label={t('common.close')}>
          <X size={17} />
        </button>
      </div>

      <AtlasExerciseBrowser search={search} onPick={pick} onPreview={preview} autoFocus />
    </div>
  );
};
