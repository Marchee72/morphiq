import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { ArrowRight, Check, Flame, Play } from 'lucide-react';
import { useT } from '../../i18n';
import type { DayCell } from '../types';

/**
 * Today's header: ember, edge to edge from the very top, carrying the week.
 *
 * It replaces the greeting, the hero card and the week card — one surface that
 * says who and when, where the week stands (sessions against the goal, the
 * seven days, what they weighed) and the one thing to do next.
 *
 * On scroll it goes with the page, shrinking and dimming as it leaves — nothing
 * sticks. Tied to the scroll position, so scrolling back undoes it.
 */
export const AtlasTodayHeader: React.FC<{
  now: Date;
  greeting: string;
  initial: string;
  onSettings: () => void;
  week: DayCell[];
  done: number;
  goal: number;
  streak: number;
  volumeKg: number;
  minutes: number;
  workouts: number;
  /** "In progress · 12:04 · 5 sets left", when a session is running. */
  live?: string;
  ctaLabel: string;
  onCta: () => void;
  /** The group furthest behind this week, if any is. */
  upNext?: string;
  onDay: (day: Date) => void;
}> = props => {
  const { t, fmt } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // The scroller is the shell's, not ours: follow it by listening rather than
  // owning it, and keep the position in a motion value so scrolling renders
  // nothing.
  const scrollY = useMotionValue(0);
  useEffect(() => {
    const scroller = ref.current?.closest('.app-scroll');
    if (!scroller) return;
    // The status bar is the top of the header only while the header is there
    // to continue it; once it scrolls away the bar goes back to the page.
    const frame = scroller.closest('.app');
    const read = () => {
      scrollY.set(scroller.scrollTop);
      frame?.toggleAttribute('data-scrolled', scroller.scrollTop > 4);
    };
    read();
    scroller.addEventListener('scroll', read, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', read);
      frame?.removeAttribute('data-scrolled');
    };
  }, [scrollY]);

  // Shrinks towards its bottom edge, so it reads as receding into the page
  // rather than being cropped by the top of the screen.
  const shrink = {
    scale: useTransform(scrollY, [0, 320], [1, 0.86]),
    opacity: useTransform(scrollY, [80, 320], [1, 0.25]),
    transformOrigin: '50% 100%',
  };

  // Tonnage only when there is some: a week of runs is not "0.0 t".
  const tonnes = props.volumeKg > 0 ? `${fmt.n(props.volumeKg / 1000, 1)} ${t('unit.tonnes')}` : null;

  return (
    // The wrapper takes the scroll transform, not the header: the header's
    // entrance animation owns its transform and would override this one.
    <motion.div ref={ref} style={reduce ? undefined : shrink}>
      <header className="at-today-head">
        <div className="at-today-glow" aria-hidden="true" />
        <div className="at-today-in">
          <div className="at-today-top">
            <div>
              <small>{fmt.weekdayShort(props.now)}, {fmt.shortDate(props.now)}</small>
              <h1>{props.greeting}</h1>
            </div>
            <button className="at-today-avatar" onClick={props.onSettings} aria-label={t('nav.settings')}>
              {props.initial}
            </button>
          </div>

          {props.live && <p className="at-today-live">● {props.live}</p>}

          <section className="at-today-week" aria-label={t('today.weekSummary')}>
            <div className="at-today-week-head">
              <small>{t('today.weekSummary')}</small>
              {props.streak > 0 && (
                <span className="at-today-streak"><Flame size={12} /> {props.streak}</span>
              )}
            </div>
            <div className="at-today-count">
              <b>{props.done}</b><span>/{props.goal}</span>
              <em>{t('gym.workouts').toLowerCase()}</em>
            </div>
            <ol className="at-today-days">
              {props.week.map((day, i) => (
                <li key={day.date.toISOString()}>
                  <button
                    onClick={() => props.onDay(day.date)}
                    aria-label={t('today.openDay', { date: fmt.shortDate(day.date) })}
                  >
                    <small>{fmt.weekdayShort(day.date).charAt(0).toUpperCase()}</small>
                    <span data-done={day.done} data-today={day.isToday} style={{ animationDelay: `${250 + i * 50}ms` }}>
                      {day.done ? <Check size={15} strokeWidth={3} /> : day.date.getDate()}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {props.workouts > 0 && (
              <dl className="at-today-stats">
                {tonnes && <div><dt>{t('today.volume')}</dt><dd>{tonnes}</dd></div>}
                <div><dt>{t('summary.duration')}</dt><dd>{props.minutes} min</dd></div>
                <div><dt>{t('gym.workouts')}</dt><dd>{props.workouts}</dd></div>
              </dl>
            )}
          </section>

          <div className="at-today-ctarow">
            <button className="at-today-cta" onClick={props.onCta}>
              {props.live ? <ArrowRight size={17} /> : <Play size={16} fill="currentColor" />}
              {props.ctaLabel}
            </button>
            {props.upNext && (
              <span className="at-today-next">{t('today.upNext')}<b>{props.upNext}</b></span>
            )}
          </div>
        </div>
      </header>
    </motion.div>
  );
};
