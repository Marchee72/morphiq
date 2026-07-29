import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, Search, Trophy, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useAppActions, useAppData } from '../data/useAppData';
import { useDismissOnBack } from '../components/useDismissOnBack';
import { dayKey, startOfDay, MS_PER_DAY } from '../derive/buckets';
import type { HistoryEntryVM } from '../types';
import { AtlasStates } from './AtlasStates';

/**
 * Every session you have logged, by day.
 *
 * The Train hub and Today each showed a flat, capped slice of `training.history`
 * with nothing to filter by and nothing to tap — enough to say "you trained",
 * not enough to answer "what did I do last Tuesday". Seven days is the default
 * because that is the window people actually ask about; the date picker covers
 * the rest.
 */

type Range = 7 | 30 | 0; // 0 = everything loaded

/** `<input type="date">` speaks `YYYY-MM-DD` in local time; `toISOString` does not. */
function toDateInput(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromDateInput(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/**
 * Accent- and case-insensitive, so "press" finds "Press" and "biceps" finds
 * "Bíceps" — the catalogue and the coach both produce accented Spanish names.
 */
function foldForSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** How many exercise names a session row lists before it summarises the rest. */
const NAMES_SHOWN = 3;

export const AtlasHistory: React.FC<{
  open: boolean;
  onClose: () => void;
  onOpenSession: (workoutLogId: string) => void;
}> = ({ open, onClose, onOpenSession }) => {
  const { t, tp, fmt } = useT();
  const { training } = useAppData();
  const actions = useAppActions();

  const [range, setRange] = useState<Range>(7);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  /** Free-text over the exercises a session contained, and over its title. */
  const [query, setQuery] = useState('');

  /**
   * The clock the ranges are measured from, re-read each time the panel opens.
   *
   * A fresh `new Date()` per render would make every memo below unstable; a
   * frozen one would still be yesterday's midnight after the app had been left
   * open overnight. Re-seeding during render on the open edge is the same
   * pattern `AtlasFinishSheet` and `useSetDraft` use.
   */
  const [now, setNow] = useState(() => new Date());
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setNow(new Date());
  }

  useDismissOnBack(open, onClose, 'history');

  const inRange = useMemo(() => {
    if (pickedDate) {
      const key = dayKey(pickedDate);
      return training.history.filter(entry => dayKey(entry.at) === key);
    }
    if (range === 0) return training.history;
    // Inclusive of today: a 7-day window means the last seven calendar days.
    const since = startOfDay(new Date(now.getTime() - (range - 1) * MS_PER_DAY)).getTime();
    return training.history.filter(entry => entry.at.getTime() >= since);
  }, [training.history, range, pickedDate, now]);

  /**
   * Searching is about finding one lift, and the lift is almost never in the
   * session's title — most sessions are called "Strength Training". Matching the
   * exercises the session actually contained is what makes "when did I last
   * squat" answerable; the title is matched too so routine names still work.
   */
  const visible = useMemo(() => {
    const needle = foldForSearch(query);
    if (!needle) return inRange;
    return inRange.filter(entry =>
      foldForSearch(entry.title).includes(needle)
      || entry.exercises.some(name => foldForSearch(name).includes(needle)));
  }, [inRange, query]);

  const days = useMemo(() => {
    const grouped = new Map<string, { date: Date; entries: HistoryEntryVM[] }>();
    for (const entry of visible) {
      const key = dayKey(entry.at);
      const bucket = grouped.get(key) ?? { date: startOfDay(entry.at), entries: [] };
      bucket.entries.push(entry);
      grouped.set(key, bucket);
    }
    return [...grouped.values()]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(day => ({
        ...day,
        entries: [...day.entries].sort((a, b) => b.at.getTime() - a.at.getTime()),
        volumeKg: day.entries.reduce((total, entry) => total + entry.volumeKg, 0),
      }));
  }, [visible]);

  if (!open) return null;

  const pickDate = async (value: string) => {
    const date = fromDateInput(value);
    setPickedDate(date);
    if (!date) return;

    // The provider loads a year at mount. Anything older has to be fetched
    // before it can be filtered to.
    const oldest = training.history.at(-1)?.at;
    if (oldest && date < startOfDay(oldest)) {
      setLoadingOlder(true);
      try {
        await actions.loadOlderHistory(startOfDay(date), new Date(date.getTime() + MS_PER_DAY));
      } finally {
        setLoadingOlder(false);
      }
    }
  };

  return (
    <div className="at-picker" role="dialog" aria-label={t('history.title')}>
      <div className="at-editor-head">
        <div>
          <small>{t('history.subtitle')}</small>
          <h3 className="at-serif">{t('history.title')}</h3>
        </div>
        <button className="at-round" onClick={onClose} aria-label={t('common.close')}>
          <X size={17} />
        </button>
      </div>

      <div className="at-chiprail">
        {([7, 30, 0] as Range[]).map(option => (
          <button
            key={option}
            className="at-chip"
            data-on={!pickedDate && range === option}
            onClick={() => { setRange(option); setPickedDate(null); }}
          >
            {option === 7 ? t('history.range7') : option === 30 ? t('history.range30') : t('history.rangeAll')}
          </button>
        ))}
      </div>

      {/* Sits above the date picker on purpose: "which day was that" is a rarer
          question than "when did I last do this lift". */}
      <div className="at-searchpill">
        <Search size={17} color="var(--muted)" />
        <input
          type="search"
          value={query}
          placeholder={t('history.searchPlaceholder')}
          onChange={e => setQuery(e.target.value)}
          aria-label={t('history.searchExercise')}
        />
        {query && (
          <button
            className="at-round"
            onClick={() => setQuery('')}
            aria-label={t('history.clearSearch')}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="at-searchpill">
        <CalendarDays size={17} color="var(--muted)" />
        <input
          type="date"
          value={pickedDate ? toDateInput(pickedDate) : ''}
          max={toDateInput(now)}
          onChange={e => { void pickDate(e.target.value); }}
          aria-label={t('history.jumpToDate')}
        />
        {pickedDate && (
          <button
            className="at-round"
            onClick={() => setPickedDate(null)}
            aria-label={t('history.clearDate')}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {loadingOlder && <div className="at-filter-label">{t('history.loadingOlder')}</div>}

      {days.length > 0 ? (
        <div className="at-pad" style={{ paddingBottom: 40 }}>
          {days.map(day => (
            <div key={dayKey(day.date)} className="at-history-day">
              {/* The date is the heading rather than "3 weeks ago": this is the
                  screen you come to when you need to know *which* day. The
                  relative reading keeps its place next to the totals, where it
                  is still a useful orientation without being the label. */}
              <div className="at-history-dayhead">
                <b>{fmt.dmy(day.date)}</b>
                <span>
                  {fmt.relativeDay(day.date, now)} · {t('history.dayTotal', {
                    sessions: tp('history.sessions', day.entries.length),
                    volume: fmt.n(day.volumeKg / 1000, 1),
                    unit: t('unit.tonnes'),
                  })}
                </span>
              </div>
              <div className="at-card" style={{ padding: '8px 20px' }}>
                {day.entries.map((entry, i) => (
                  <button
                    key={entry.id}
                    className="at-routine-item"
                    style={{ borderTop: i === 0 ? 'none' : undefined, width: '100%' }}
                    onClick={() => onOpenSession(entry.id)}
                    aria-label={t('history.openSession', { name: entry.title })}
                  >
                    <span>
                      {entry.title}
                      <small>
                        {fmt.clock(entry.at)} · {entry.durationMin} min · {tp('unit.sets', entry.sets)}
                        {entry.prs > 0 && ` · ${entry.prs} PR`}
                      </small>
                      {/* What the session was, as opposed to what it was
                          called. Most titles are "Strength Training". */}
                      {entry.exercises.length > 0 && (
                        <small className="at-history-exercises">
                          {entry.exercises.slice(0, NAMES_SHOWN).join(' · ')}
                          {entry.exercises.length > NAMES_SHOWN
                            && ` +${entry.exercises.length - NAMES_SHOWN}`}
                        </small>
                      )}
                    </span>
                    <b>
                      {entry.prs > 0 && <Trophy size={13} color="var(--clay)" />}
                      {fmt.n(entry.volumeKg / 1000, 1)} {t('unit.tonnes')}
                      <ChevronRight size={15} />
                    </b>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AtlasStates
          icon={query ? <Search size={22} /> : <CalendarDays size={22} />}
          title={query ? t('history.noMatch', { query }) : t('history.empty')}
          body={query ? t('history.noMatchSub') : t('history.emptySub')}
          action={query
            ? { label: t('history.clearSearch'), onClick: () => setQuery('') }
            : undefined}
        />
      )}

      <div style={{ height: 20 }} />
    </div>
  );
};
