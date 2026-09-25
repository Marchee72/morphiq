import React from 'react';
import { useT } from '../../i18n';
import { useAppData } from '../data/useAppData';
import { heatColor, heatLevel } from '../derive/heatColor';
import { freshGroups, goalNudge } from '../derive/todayTraining';
import type { MuscleGroupId } from '../types';

/**
 * Muscle balance — how the week's sets are spread across the body.
 *
 * The card used to be a body map beside two blocks that repeated the rest of the
 * screen: the last session, which "Today's training" states above and the recent
 * list states below, and the weekly goal with its streak, which the week card
 * now owns outright. Three copies of the same two facts, and the one thing only
 * this card could say — how the week is distributed across the body — was left
 * entirely to colour, on a figure 96px tall.
 *
 * So the card is the heat map read as numbers: every group, heaviest first,
 * each bar coloured by the same scale. The figure that used to sit beside them
 * said the same thing less legibly, and is gone. The nudge stays as the
 * takeaway, because "which of these do I train next" is the question the
 * distribution exists to answer.
 */
export const AtlasHeatMap: React.FC<{
  onPickRegion: (group: MuscleGroupId) => void;
}> = ({ onPickRegion }) => {
  const { t, tp } = useT();
  const { training } = useAppData();
  const now = new Date();

  const streak = training.streak;
  const trainedToday = training.today.sessions.length > 0;

  const nudge = goalNudge(
    { weekDone: streak.weekDone, weekGoal: streak.weekGoal, trainedToday },
    training.muscleLoad.rows,
  );
  const fresh = freshGroups(training.muscleLoad.rows, now);

  /** Join up to two group labels with the locale's "and". */
  const freshLabels = (): string => {
    const labels = fresh.map(f => t(f.labelKey));
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    return `${labels[0]} ${t('common.and')} ${labels[1]}`;
  };

  /** Days since the freshest of the fresh groups was last trained. */
  const freshDays = (): number => {
    if (fresh.length === 0) return 0;
    const last = fresh[0].lastHitAt;
    if (!last) return 0;
    return Math.round((now.getTime() - last.getTime()) / 86_400_000);
  };

  const nudgeText = (): string => {
    switch (nudge.kind) {
      case 'goalHit':
        return t('today.goalHit');
      case 'goalRemaining':
        return tp('today.goalRemaining', nudge.remaining);
      case 'goalMetFresh': {
        const groups = freshLabels();
        return groups
          ? t('today.goalMetFresh', { groups })
          : t('today.goalHit');
      }
      case 'goalFresh': {
        const groups = freshLabels();
        const days = freshDays();
        if (!groups) return tp('today.goalRemaining', streak.weekGoal - streak.weekDone);
        return days > 0
          ? t('today.goalFresh', { groups, days })
          : t('today.goalFreshNoDays', { groups });
      }
    }
  };

  /**
   * Heaviest group first, so the imbalance is the first thing read rather than
   * something to be found by comparing colours. Sorted off a copy — `rows`
   * keeps the fixed group order other screens rely on.
   */
  const ranked = [...training.muscleLoad.rows].sort((a, b) => b.sets - a.sets);

  return (
    <div className="at-card at-heatmap-card">
      <div className="at-heatmap-head">
        <h4 className="at-serif">{t('today.balance')}</h4>
        <span className="at-heatmap-label">{t('today.muscleLoad')}</span>
      </div>

      <div className="at-heatmap-rows">
        {ranked.map(row => {
          // One scale for the whole card: the bar's length and its colour
          // are the same number.
          const level = heatLevel(row.sets);
          return (
            <button
              key={row.group}
              className="at-heatgroup"
              onClick={() => onPickRegion(row.group)}
              aria-label={`${t(row.labelKey)} · ${tp('unit.sets', row.sets)}`}
            >
              <span>{t(row.labelKey)}</span>
              <i aria-hidden="true">
                <u style={{ width: `${Math.max(level * 100, row.sets > 0 ? 5 : 0)}%`, background: heatColor(level) }} />
              </i>
              <b>{row.sets}</b>
            </button>
          );
        })}
      </div>

      <p className="at-heatmap-nudge">{nudgeText()}</p>
    </div>
  );
};
