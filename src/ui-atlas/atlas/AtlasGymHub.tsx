import React, { useRef, useState } from 'react';
import { ListOrdered, Play, Plus, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { useT } from '../../i18n';
import { RoutineCopyButton } from '../components/RoutineCopyButton';
import { useAppData, useAppActions } from '../data/useAppData';
import { AtlasStates } from './AtlasStates';
import { AtlasSessionDetail } from './AtlasSessionDetail';

/** A record set in the last week is news; older ones are just the list. */
const NEW_RECORD_MS = 7 * 86_400_000;

/**
 * The Train tab when no session is running.
 *
 * Led by the answer to "what do I train today": the groups rested longest,
 * with the lifts you last did them with, one tap from starting. Below it the
 * three other ways in — a free session, repeating the last one, a routine —
 * then the routines themselves, records and history.
 */
export const AtlasGymHub: React.FC = () => {
  const { training, sessionDetail, suggestTraining } = useAppData();
  const actions = useAppActions();
  const { t, tp, fmt } = useT();
  const now = new Date();
  const routinesRef = useRef<HTMLDivElement>(null);

  // Local, as in AtlasLibrary: the sheet belongs to the list that opened it.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const suggestion = suggestTraining(offset);
  const liftedToday = training.today.sessions.length > training.today.cardioSessions.length;
  const names = suggestion?.groups.map(g => t(g.labelKey)) ?? [];
  const title = names.length > 1
    ? `${names.slice(0, -1).join(', ')} ${t('common.and')} ${names[names.length - 1].toLowerCase()}`
    : names[0] ?? '';
  const days = suggestion?.groups.map(g => g.daysSince) ?? [];
  const daysLine = days.length > 1
    ? t('train.suggestDaysMany', { days: `${days.slice(0, -1).join(', ')} ${t('common.and')} ${days[days.length - 1]}` })
    : t('train.suggestDaysOne', { days: days[0] ?? 0 });

  // The most recent session with lifts in it, repeated as it was done — same
  // lifts, same sets. A run from the watch has nothing to repeat here.
  const repeatable = training.history
    .filter(entry => !entry.cardio)
    .slice(0, 5)
    .map(entry => sessionDetail(entry.id))
    .find(detail => detail !== null && detail.exercises.length > 0) ?? null;

  return (
    <>
      <header className="at-hub-head">
        <div>
          <small>{fmt.weekdayShort(now)}, {fmt.shortDate(now)}</small>
          <h1>{t('nav.train')}</h1>
        </div>
        <ol className="at-hub-week" aria-label={t('today.weekSummary')}>
          {training.streak.week.map(day => (
            <li key={day.date.toISOString()} data-done={day.done} data-today={day.isToday}>
              {fmt.weekdayShort(day.date).charAt(0).toUpperCase()}
            </li>
          ))}
        </ol>
      </header>

      {/* Not once today's gym session is in — "train today" over a day already
          trained reads as an order to go again. A run alone does not count. */}
      {suggestion && !liftedToday && (
        <section className="at-hub-suggest at-enter" aria-label={t('train.suggestKicker')}>
          <div className="at-today-glow" aria-hidden="true" />
          <small><Sparkles size={14} /> {t('train.suggestKicker')}</small>
          <h2>{title}</h2>
          <p>
            {daysLine}
            {suggestion.routine && <> · {t('train.suggestFits')} <b>{suggestion.routine.title}</b></>}
          </p>
          {suggestion.exercises.length > 0 && (
            <ol>
              {suggestion.exercises.map(ex => (
                <li key={ex.name}><span>{ex.name}</span><span>{ex.sets} × {ex.reps}</span></li>
              ))}
            </ol>
          )}
          <div className="at-hub-suggest-actions">
            <button
              className="at-today-cta"
              onClick={() => actions.startWith(title, suggestion.exercises.map(ex => ({
                exerciseId: ex.exerciseId ?? '',
                exerciseName: ex.name,
                targetSets: ex.sets,
                targetReps: ex.reps,
              })))}
            >
              <Play size={16} fill="currentColor" /> {t('train.suggestStart')}
            </button>
            {suggestion.options > 1 && (
              <button className="at-hub-another" onClick={() => setOffset(o => o + 1)} aria-label={t('train.suggestAnother')}>
                <RotateCcw size={18} />
              </button>
            )}
          </div>
        </section>
      )}

      <div className="at-hub-quick at-enter" style={{ animationDelay: '60ms' }}>
        <button onClick={() => actions.beginSession()}>
          <i data-tone="primary"><Plus size={18} /></i>{t('train.freeSession')}
        </button>
        {repeatable && (
          <button onClick={() => actions.startWith(repeatable.title, repeatable.exercises.map(ex => ({
            exerciseId: ex.exerciseId ?? '',
            exerciseName: ex.name,
            // The sets that were performed, so repeating means the same work.
            targetSets: ex.sets.length,
          })))}>
            <i data-tone="amber"><RotateCcw size={18} /></i>{t('train.repeatLast')}
          </button>
        )}
        <button onClick={() => routinesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <i data-tone="coral"><ListOrdered size={18} /></i>{t('gym.routines')}
        </button>
      </div>

      <div className="at-rail-head" ref={routinesRef}><h3>{t('gym.routines')}</h3></div>
      {training.routines.length > 0 ? (
        <div className="at-pad">
          <div className="at-card" style={{ padding: '8px 20px' }}>
            {training.routines.map((routine, i) => (
              /* A row of two buttons rather than one button containing another,
                 which is invalid and which swallowed the inner click. */
              <div
                key={routine.id ?? routine.title}
                className="at-routine-item"
                style={{ borderTop: i === 0 ? 'none' : undefined }}
              >
                <button
                  className="at-routine-open"
                  onClick={() => actions.startRoutine(routine)}
                >
                  <span>
                    {routine.title}
                    <small>{tp('unit.sets', routine.exercises.reduce((n, e) => n + e.targetSets, 0))}</small>
                  </span>
                  <b><Play size={15} /></b>
                </button>
                <RoutineCopyButton routine={routine} className="at-routine-copy" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <AtlasStates title={t('gym.noRoutines')} body={t('gym.noRoutinesSub')} />
      )}

      {training.records.length > 0 && (
        <>
          <div className="at-rail-head"><h3>{t('gym.records')}</h3></div>
          <div className="at-pad">
            <div className="at-card at-hub-records">
              {training.records.slice(0, 4).map(record => {
                const fresh = now.getTime() - record.at.getTime() < NEW_RECORD_MS;
                return (
                  <div key={record.exerciseName} className="at-hub-record">
                    <i aria-hidden="true"><Trophy size={16} /></i>
                    <span>
                      <b>{record.exerciseName}</b>
                      <small>{fmt.kgReps(record.weightKg, record.reps)} · 1RM ≈ {fmt.n(record.e1rm)} {t('unit.kg')}</small>
                    </span>
                    <em data-fresh={fresh}>{fresh ? t('train.newRecord') : fmt.relativeDay(record.at, now)}</em>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="at-rail-head">
        <h3>{t('gym.history')}</h3>
        {training.history.length > 0 && (
          <button onClick={() => actions.openOverlay('history')}>{t('common.seeAll')}</button>
        )}
      </div>
      {training.history.length > 0 ? (
        <ol className="at-recent">
          {training.history.slice(0, 10).map(entry => (
            <li key={entry.id} data-kind={entry.prs > 0 ? 'pr' : entry.cardio ? 'cardio' : 'lift'}>
              <button onClick={() => setSessionId(entry.id)} aria-label={t('history.openSession', { name: entry.title })}>
                <small><i aria-hidden="true" />{fmt.relativeDay(entry.at, now)}</small>
                <b>{entry.title}</b>
                <span>
                  {entry.cardio
                    ? `${entry.durationMin} min`
                    : [
                        `${entry.durationMin} min`,
                        `${fmt.n(entry.volumeKg / 1000, 1)} ${t('unit.tonnes')}`,
                        tp('unit.sets', entry.sets),
                      ].join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <AtlasStates title={t('gym.noHistory')} body={t('today.noSessionSub')} />
      )}

      <AtlasSessionDetail workoutLogId={sessionId} onClose={() => setSessionId(null)} />
    </>
  );
};
