import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppData } from '../data/useAppData';
import { heatColor, heatLevel } from '../derive/heatColor';
import { freshGroups, goalNudge } from '../derive/todayTraining';
import { BodyMap, type Side } from './BodyMap';
import { AtlasSegment } from './AtlasField';
import type { MuscleGroupId } from '../types';

/**
 * The combined card that replaces the old X/16 muscle-load block on Today.
 *
 * Left: a body heat map (front/back segment) with each region colored by weekly
 * set volume. Right: the last session summary and a goal/streak nudge. Tapping
 * a region opens the detail sheet — the parent owns that state.
 */
export const AtlasHeatMap: React.FC<{
  onPickRegion: (group: MuscleGroupId) => void;
}> = ({ onPickRegion }) => {
  const { t, tp, fmt } = useT();
  const { training } = useAppData();
  const now = new Date();

  const [side, setSide] = useState<Side>('front');

  const previous = training.today.previous;
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

  return (
    <div className="at-card at-heatmap-card">
      <div className="at-heatmap">
        {/* Body heat map */}
        <div className="at-heatmap-figure">
          <div className="at-heatmap-label">{t('today.bodyHeat')}</div>
          <BodyMap side={side} active={null} onPick={onPickRegion} fill={heatFill} />
          <div className="at-heatmap-legend" />
          <div className="at-heatmap-legend-labels">
            <span>{t('today.heatRested')}</span>
            <span>{t('today.heatTrained')}</span>
          </div>
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

        {/* Last session + Today */}
        <div className="at-heatmap-info">
          <div className="at-heatmap-label">{t('today.lastSession')}</div>
          {previous ? (
            <>
              <h4>{previous.title}</h4>
              <div className="at-heatmap-exercises">
                {previous.exercises.join(' · ')}
              </div>
              <div className="at-heatmap-stats">
                <span><b>{tp('unit.sets', previous.sets)}</b></span>
                <span><b>{fmt.n(previous.volumeKg / 1000, 1)} {t('unit.tonnes')}</b></span>
                <span><b>{previous.durationMin} min</b></span>
                {previous.prs > 0 && (
                  <span><b style={{ color: 'var(--clay)' }}><Trophy size={11} /> {previous.prs}</b></span>
                )}
              </div>
            </>
          ) : (
            <h4>{t('today.neverTrained')}</h4>
          )}

          <div className="at-heatmap-today">
            <div className="at-heatmap-label">{t('today.todayLabel')}</div>
            <div className="at-heatmap-today-goal">
              {t('today.weeklyGoal', { done: streak.weekDone, goal: streak.weekGoal })}
              {streak.current > 0 && ` · ${t('today.streak', { n: streak.current })}`}
            </div>
            <div className="at-heatmap-today-nudge">{nudgeText()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
