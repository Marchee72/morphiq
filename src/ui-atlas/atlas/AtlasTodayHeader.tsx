import React, { useEffect, useLayoutEffect, useRef } from 'react';
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
 * On scroll it minimises and stays in the page: the week section folds away
 * as you scroll (its height follows the scroll position), leaving a compact
 * card — the greeting and the start button, with "up next" handing over to the
 * week as seven dots. Nothing sticks; once compact it scrolls on with the page,
 * and scrolling back unfolds it.
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
  const weekRef = useRef<HTMLElement>(null);

  // The scroller is the shell's, not ours: follow it by listening rather than
  // owning it, and keep the position in a motion value so scrolling renders
  // nothing.
  const scrollY = useMotionValue(0);
  useEffect(() => {
    const scroller = ref.current?.closest('.app-scroll');
    if (!scroller) return;
    const read = () => scrollY.set(scroller.scrollTop);
    read();
    scroller.addEventListener('scroll', read, { passive: true });
    return () => scroller.removeEventListener('scroll', read);
  }, [scrollY]);

  // How much folds away: the week section's natural height, measured, since it
  // depends on what the week holds. Until measured the fold stays open.
  const weekHeight = useMotionValue(0);
  useLayoutEffect(() => {
    const week = weekRef.current;
    if (!week) return;
    // Plus the 16px the section sits below the fold's top (see atlas.css).
    const measure = () => weekHeight.set(week.offsetHeight + 16);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(week);
    return () => observer.disconnect();
  }, [weekHeight]);

  const progress = useTransform([scrollY, weekHeight], ([y, h]: number[]) => (h > 0 ? Math.min(1, y / h) : 0));
  const foldHeight = useTransform([scrollY, weekHeight], ([y, h]: number[]) => (h > 0 ? Math.max(0, h - y) : 'auto'));
  const foldOpacity = useTransform(progress, [0, 0.7], [1, 0]);
  const nextOpacity = useTransform(progress, [0.75, 0.95], [1, 0]);
  const miniOpacity = useTransform(progress, [0.8, 1], [0, 1]);

  // Tonnage only when there is some: a week of runs is not "0.0 t".
  const tonnes = props.volumeKg > 0 ? `${fmt.n(props.volumeKg / 1000, 1)} ${t('unit.tonnes')}` : null;

  return (
    <div ref={ref}>
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

          {/* Folds away as the page scrolls. The fold's gap to the start button
              goes with it, so the compact card is not left with a hole. */}
          <motion.div className="at-today-fold" style={reduce ? undefined : { height: foldHeight, opacity: foldOpacity }}>
            <section className="at-today-week" ref={weekRef} aria-label={t('today.weekSummary')}>
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
          </motion.div>

          <div className="at-today-ctarow">
            <button className="at-today-cta" onClick={props.onCta}>
              {props.live ? <ArrowRight size={17} /> : <Play size={16} fill="currentColor" />}
              {props.ctaLabel}
            </button>
            <span className="at-today-ctaside">
              {props.upNext && (
                <motion.span className="at-today-next" style={{ opacity: nextOpacity }}>
                  {t('today.upNext')}<b>{props.upNext}</b>
                </motion.span>
              )}
              {/* The week, once the header has collapsed onto this strip. The
                  full week above says the same to a screen reader. */}
              <motion.span className="at-today-mini" style={{ opacity: miniOpacity }} aria-hidden="true">
                <b>{props.done}/{props.goal}</b>
                <span className="at-today-dots">
                  {props.week.map(day => (
                    <i key={day.date.toISOString()} data-done={day.done} data-today={day.isToday} />
                  ))}
                </span>
              </motion.span>
            </span>
          </div>
        </div>
      </header>
    </div>
  );
};
