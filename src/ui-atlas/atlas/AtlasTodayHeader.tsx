import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { ArrowRight, Check, Flame, Play } from 'lucide-react';
import { useT } from '../../i18n';
import type { DayCell } from '../types';

/** The float shadow, for once the header has collapsed onto the page. */
const FLOAT = '0 10px 24px rgba(90, 20, 5, 0.3)';
const NO_FLOAT = '0 0 0 rgba(90, 20, 5, 0)';

/**
 * Today's header: ember, edge to edge from the very top, carrying the week.
 *
 * It replaces the greeting, the hero card and the week card — one surface that
 * says who and when, where the week stands (sessions against the goal, the
 * seven days, what they weighed) and the one thing to do next.
 *
 * On scroll it minimises rather than leaving: it is sticky with a negative
 * `top`, so it scrolls with the page until only its last strip — the start
 * button — is left, and holds there. The part scrolling under the top fades as
 * it goes, and in the strip "up next" hands over to the week as seven dots, so
 * the collapsed header still says where the week stands. All of it follows the
 * scroll position, so scrolling back undoes it.
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
  const ctaRef = useRef<HTMLDivElement>(null);

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

  // How far the header travels before it holds: everything above the start
  // button's strip. Measured, because the header's height depends on what it
  // carries (a live session, a week with or without numbers).
  const collapse = useMotionValue(0);
  const top = useTransform(collapse, c => -c);
  useLayoutEffect(() => {
    const measure = () => {
      const header = ref.current;
      const cta = ctaRef.current;
      if (!header || !cta) return;
      collapse.set(Math.max(0, cta.getBoundingClientRect().top - header.getBoundingClientRect().top - 12));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [collapse, props.live, props.workouts]);

  const progress = useTransform([scrollY, collapse], ([y, c]: number[]) => (c > 0 ? Math.min(1, y / c) : 0));
  const upperOpacity = useTransform(progress, [0, 0.8], [1, 0]);
  const nextOpacity = useTransform(progress, [0.75, 0.95], [1, 0]);
  const miniOpacity = useTransform(progress, [0.8, 1], [0, 1]);
  const shadow = useTransform(progress, p => (p >= 0.99 ? FLOAT : NO_FLOAT));

  // Tonnage only when there is some: a week of runs is not "0.0 t".
  const tonnes = props.volumeKg > 0 ? `${fmt.n(props.volumeKg / 1000, 1)} ${t('unit.tonnes')}` : null;

  return (
    <motion.div ref={ref} className="at-today-sticky" style={{ top }}>
      <motion.header className="at-today-head" style={{ boxShadow: shadow }}>
        <div className="at-today-glow" aria-hidden="true" />
        <div className="at-today-in">
          <motion.div className="at-today-upper" style={{ opacity: upperOpacity }}>
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
          </motion.div>

          <div className="at-today-ctarow" ref={ctaRef}>
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
      </motion.header>
    </motion.div>
  );
};
