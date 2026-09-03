import React, { useState } from 'react';
import { useT } from '../../i18n';
import { useAppData } from '../data/useAppData';
import { heatColor, heatLevel } from '../derive/heatColor';
import { freshGroups, goalNudge } from '../derive/todayTraining';
import { BodyMap, type Side } from './BodyMap';
import { AtlasSegment } from './AtlasField';
import type { MuscleGroupId } from '../types';

/**
 * Muscle balance — the figure, and the numbers behind its colours.
 *
 * The card used to be a body map beside two blocks that repeated the rest of the
 * screen: the last session, which "Today's training" states above and the recent
 * list states below, and the weekly goal with its streak, which the week card
 * now owns outright. Three copies of the same two facts, and the one thing only
 * this card could say — how the week is distributed across the body — was left
 * entirely to colour, on a figure 96px tall.
 *
 * So the right-hand column is now the heat map read as numbers: every group,
 * heaviest first, each bar the same length-and-colour the figure is painted
 * with. The nudge stays as the takeaway, because "which of these do I train
 * next" is the question the distribution exists to answer.
 */
export const AtlasHeatMap: React.FC<{
  onPickRegion: (group: MuscleGroupId) => void;
}> = ({ onPickRegion }) => {
  const { t, tp } = useT();
  const { training } = useAppData();
  const now = new Date();

  const [side, setSide] = useState<Side>('front');

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

  /**
   * How hot a region is drawn. A group with no row this week has no sets, which
   * is the rested end of the scale rather than an absent colour.
   */
  const heatFill = (group: MuscleGroupId): string => {
    const row = training.muscleLoad.rows.find(r => r.group === group);
    return heatColor(heatLevel(row?.sets ?? 0));
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
   * something to be found by comparing six colours. Sorted off a copy — `rows`
   * is in fixed order precisely so the figure never reflows.
   */
  const ranked = [...training.muscleLoad.rows].sort((a, b) => b.sets - a.sets);

  return (
    <div className="at-card at-heatmap-card">
      <div className="at-heatmap-head">
        <h4 className="at-serif">{t('today.balance')}</h4>
        <div className="at-heatmap-side">
          <AtlasSegment
            value={side}
            onChange={setSide}
            options={[
              { value: 'front', label: t('today.front') },
              { value: 'back', label: t('today.back') },
            ]}
          />
        </div>
      </div>

      <div className="at-heatmap">
        <div className="at-heatmap-figure">
          <BodyMap side={side} active={null} onPick={onPickRegion} fill={heatFill} />
          <div className="at-heatmap-legend" />
          <div className="at-heatmap-legend-labels">
            <span>{t('today.heatRested')}</span>
            <span>{t('today.heatTrained')}</span>
          </div>
        </div>

        <div className="at-heatmap-rows">
          <div className="at-heatmap-label">{t('today.muscleLoad')}</div>
          {ranked.map(row => {
            // One scale for the whole card: the bar's length and its colour are
            // the same number the figure is painted with, so a limb and its row
            // can never disagree about how hard the week hit it.
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
      </div>

      <p className="at-heatmap-nudge">{nudgeText()}</p>
    </div>
  );
};
