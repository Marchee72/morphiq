import React, { useState } from 'react';
import { useT } from '../../i18n';
import { useAppData } from '../data/useAppData';
import { borgLabelKey } from '../derive/borg';
import type { StatWindow } from '../derive/exerciseStats';
import { AtlasSegment } from './AtlasField';
import { AtlasMetricChart } from './AtlasMetricChart';
import { AtlasSheet } from './AtlasSheet';

/**
 * One exercise, measured.
 *
 * The detail sheet says what an exercise is and lists what you did on it. This
 * answers the questions you would otherwise work out from that list by eye: is
 * the estimated max moving, how much work is going in, what is the best set at
 * each rep range, and how long the number has been stuck.
 *
 * Mounted on `AtlasExerciseDetail`'s local state rather than as an `OverlayId` —
 * the shell's single overlay slot is for things reachable from more than one
 * screen, and this is only ever reached from there. Same reasoning as
 * `AtlasMetricDetail` sitting on `AtlasBody`.
 */
export const AtlasExerciseStats: React.FC<{
  exerciseName: string;
  displayName: string;
  onClose: () => void;
}> = ({ exerciseName, displayName, onClose }) => {
  const { t, tp, fmt } = useT();
  const { exerciseStats } = useAppData();
  const [window, setWindow] = useState<StatWindow>('8w');

  const stats = exerciseStats(exerciseName, window);
  const now = new Date();

  return (
    <AtlasSheet
      open
      onClose={onClose}
      title={displayName}
      subtitle={t('stats.title')}
    >
      <AtlasSegment<StatWindow>
        options={[
          { value: '8w', label: t('stats.window8w') },
          { value: '6m', label: t('stats.window6m') },
          { value: 'all', label: t('stats.windowAll') },
        ]}
        value={window}
        onChange={setWindow}
      />

      {!stats || stats.sessions === 0 ? (
        <p className="at-summary-empty">{t('stats.emptyWindow')}</p>
      ) : (
        <>
          <div className="at-summary-stats" data-cols="3">
            <div>
              {/* An em-dash, not a zero: no scoreable set in the window is not
                  an estimated max of nothing. */}
              <b>{stats.currentE1rm === null ? '—' : fmt.upTo(stats.currentE1rm, 1)}<i>{t('unit.kg')}</i></b>
              <small>{t('stats.currentE1rm')}</small>
            </div>
            <div>
              <b>{stats.e1rmDelta === null ? '—' : fmt.signed(stats.e1rmDelta, 1)}<i>{t('unit.kg')}</i></b>
              <small>{t('stats.change')}</small>
            </div>
            <div>
              <b>{stats.sessions}</b>
              <small>{t('stats.sessions')}</small>
            </div>
          </div>

          {stats.e1rmSeries && (
            <div>
              <div className="at-field-label">{t('stats.e1rmTrend')}</div>
              <div className="at-card" style={{ padding: '18px 16px 12px' }}>
                <AtlasMetricChart
                  series={stats.e1rmSeries}
                  decimals={1}
                  height={140}
                  now={now}
                  weeks={stats.weeks}
                />
              </div>
            </div>
          )}

          {stats.volumeSeries && (
            <div>
              <div className="at-field-label">{t('stats.volumeTrend')}</div>
              <div className="at-card" style={{ padding: '18px 16px 12px' }}>
                <AtlasMetricChart
                  series={stats.volumeSeries}
                  decimals={0}
                  height={110}
                  now={now}
                  weeks={stats.weeks}
                />
              </div>
            </div>
          )}

          <div className="at-summary-stats" data-cols="3">
            <div>
              <b>{fmt.n(stats.totalVolumeKg)}<i>{t('unit.kg')}</i></b>
              <small>{t('stats.totalVolume')}</small>
            </div>
            <div>
              <b>{stats.totalSets}</b>
              <small>{tp('unit.sets', stats.totalSets)}</small>
            </div>
            <div>
              <b>{stats.avgRpe === null ? '—' : fmt.upTo(stats.avgRpe, 1)}</b>
              <small>{t('train.rpeAvg')}</small>
            </div>
          </div>

          {/* Ranked by weight, not by estimated max: "my best triple" means the
              heaviest one, not whichever Epley happens to score highest. */}
          {stats.repRangeBests.length > 0 && (
            <div>
              <div className="at-field-label">{t('stats.bestByReps')}</div>
              <div className="at-statrows">
                {stats.repRangeBests.map(best => (
                  <div key={best.rangeKey} className="at-statrow">
                    <span>{t(best.rangeKey)}</span>
                    <b>{fmt.kgReps(best.weightKg, best.reps)}</b>
                    <small>{fmt.dmy(best.at)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="at-statrows">
            <div className="at-statrow">
              <span>{t('stats.frequency')}</span>
              <b>{stats.sessionsPerWeek === null ? '—' : fmt.upTo(stats.sessionsPerWeek, 1)}</b>
              <small>{t('stats.perWeek')}</small>
            </div>
            {/* Measured over real sessions, so a fortnight away from the gym is
                not reported as a fortnight of stalling. */}
            <div className="at-statrow">
              <span>{t('stats.sinceBest')}</span>
              <b>{stats.stalledWeeks === null ? '—' : stats.stalledWeeks}</b>
              <small>{t('stats.weeks')}</small>
            </div>
            {stats.avgRpe !== null && (
              <div className="at-statrow">
                <span>{t('stats.typicalEffort')}</span>
                <b>{fmt.upTo(stats.avgRpe, 0)}</b>
                <small>{t(borgLabelKey(Math.round(stats.avgRpe)))}</small>
              </div>
            )}
          </div>
        </>
      )}
    </AtlasSheet>
  );
};
