import React, { useState } from 'react';
import { useT } from '../../i18n';
import { FEELING_OPTIONS } from '../../features/gym/feelingOptions';
import type { FeelingId } from '../types';
import { AtlasSheet } from './AtlasSheet';
import { AtlasTextarea } from './AtlasField';

export const AtlasDayNoteSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  initialFeeling?: FeelingId;
  initialNotes?: string;
  onSave: (feeling: FeelingId | undefined, notes: string | undefined) => void;
}> = ({ open, onClose, initialFeeling, initialNotes = '', onSave }) => {
  const { t } = useT();
  const [feeling, setFeeling] = useState<FeelingId | undefined>(initialFeeling);
  const [notes, setNotes] = useState(initialNotes);

  // Re-seed each time it opens, so reopening shows what is actually stored
  // rather than whatever was typed and abandoned last time. Reset happens during
  // render, not in an effect: an effect renders one frame with the stale draft
  // and triggers a cascading re-render.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setFeeling(initialFeeling);
      setNotes(initialNotes);
    }
  }

  return (
    <AtlasSheet
      open={open}
      onClose={onClose}
      title={t('train.howDoYouFeel')}
      footer={
        <button className="at-btn" onClick={() => { onSave(feeling, notes.trim() || undefined); }}>
          {t('common.save')}
        </button>
      }
    >
      <div className="at-field">
        <div className="at-choice">
          {FEELING_OPTIONS.map(option => {
            const selected = feeling === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className="at-feeling"
                data-on={selected}
                // Tapping the selected one clears it — the session may simply
                // not have a mood worth recording.
                onClick={() => setFeeling(selected ? undefined : option.id)}
                style={selected ? { background: option.bg, borderColor: option.color, color: option.color } : undefined}
                aria-pressed={selected}
              >
                <span aria-hidden="true">{option.emoji}</span> {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <AtlasTextarea
        label={t('train.dayNote')}
        value={notes}
        onChange={setNotes}
        placeholder={t('train.dayNotePlaceholder')}
      />
    </AtlasSheet>
  );
};
