import React from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import type { HistoryEntryVM } from '../types';

/**
 * One session in a list.
 *
 * The same row was written out three times — Today's "Recent", the History
 * screen and the day sheet — each with its own copy of "title · duration ·
 * sets" on the left and tonnes on the right. That was survivable while every
 * session was a gym session; it stopped being so once a run had to render
 * differently, because the branch would have had to be written three times too.
 *
 * The differences between the three callers were only ever cosmetic — which
 * time format, whether a chevron shows, whether the exercise names show — so
 * they are props, and the interesting part lives here once.
 */

/** Names shown before the list is truncated with a +N. */
const NAMES_SHOWN = 3;

export const AtlasSessionRow: React.FC<{
  entry: HistoryEntryVM;
  /** Pre-formatted, because callers differ: a clock time here, 'yesterday' there. */
  time: string;
  onClick?: () => void;
  showExercises?: boolean;
  showChevron?: boolean;
  /** Kills the top hairline on the first row of a card. */
  first?: boolean;
}> = ({ entry, time, onClick, showExercises, showChevron, first }) => {
  const { t, tp, fmt } = useT();
  const { cardio } = entry;

  /**
   * An activity is described by what it covered, not by what it lifted.
   * Distance first, then calories — a yoga session has no distance but its
   * calories are still the honest headline. Nothing at all beats "0.0 t".
   */
  const headline = cardio
    ? cardio.distanceKm != null
      ? fmt.km(cardio.distanceKm)
      : cardio.calories != null
        ? fmt.kcal(cardio.calories)
        : null
    : `${fmt.n(entry.volumeKg / 1000, 1)} ${t('unit.tonnes')}`;

  const pace = cardio?.readout === 'pace'
    ? fmt.pace(cardio.distanceKm, entry.durationMin)
    : cardio?.readout === 'speed'
      ? fmt.speed(cardio.distanceKm, entry.durationMin)
      : null;

  const body = (
    <>
      <span>
        {entry.title}
        <small>
          {time} · {entry.durationMin} min
          {/* Sets are the wrong unit for a run; its pace is the equivalent read. */}
          {cardio ? (pace ? ` · ${pace}` : '') : ` · ${tp('unit.sets', entry.sets)}`}
          {entry.prs > 0 && ` · ${entry.prs} PR`}
        </small>
        {showExercises && entry.exercises.length > 0 && (
          <small className="at-history-exercises">
            {entry.exercises.slice(0, NAMES_SHOWN).join(' · ')}
            {entry.exercises.length > NAMES_SHOWN && ` +${entry.exercises.length - NAMES_SHOWN}`}
          </small>
        )}
      </span>
      <b>
        {entry.prs > 0 && <Trophy size={13} color="var(--clay)" />}
        {headline}
        {showChevron && <ChevronRight size={15} />}
      </b>
    </>
  );

  const style = { borderTop: first ? 'none' : undefined, width: '100%' } as const;

  return onClick ? (
    <button
      className="at-routine-item"
      style={style}
      onClick={onClick}
      aria-label={t('history.openSession', { name: entry.title })}
    >
      {body}
    </button>
  ) : (
    <div className="at-routine-item" style={style}>{body}</div>
  );
};
