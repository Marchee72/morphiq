import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
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
 * On scroll it gets out of the way without losing the summary: the big header
 * shrinks and fades over the first 160 px while rising at twice the scroll
 * speed (its margin goes to −168 px), and between 110 and 180 px a compact bar
 * drops in and sticks — "Your day · 3/4", the seven dots, the numbers on one
 * line and a round start button. Both are tied to the scroll position, so
 * scrolling back undoes them. The compact bar is hidden from screen readers
 * until it shows, so the summary is never read twice.
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
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // The scroller is the shell's, not ours: follow it by listening rather than
  // owning it, and keep the position in a motion value so scrolling renders
  // nothing until the compact bar crosses its threshold.
  const scrollY = useMotionValue(0);
  useEffect(() => {
    const scroller = ref.current?.closest('.app-scroll');
    if (!scroller) return;
    const read = () => scrollY.set(scroller.scrollTop);
    read();
    scroller.addEventListener('scroll', read, { passive: true });
    return () => scroller.removeEventListener('scroll', read);
  }, [scrollY]);

  const inner = {
    scale: useTransform(scrollY, [0, 160], [1, 0.94]),
    opacity: useTransform(scrollY, [0, 160], [1, 0]),
  };
  const marginTop = useTransform(scrollY, [0, 168], [0, -168]);
  const barOpacity = useTransform(scrollY, [110, 180], [0, 1]);
  const barY = useTransform(scrollY, [110, 180], ['-110%', '0%']);
  const [compact, setCompact] = useState(false);
  useMotionValueEvent(scrollY, 'change', v => setCompact(v > 150));

  // Tonnage only when there is some: a week of runs is not "0.0 t".
  const tonnes = props.volumeKg > 0 ? `${fmt.n(props.volumeKg / 1000, 1)} ${t('unit.tonnes')}` : null;
  const numbers = [tonnes, `${props.minutes} min`, `${props.workouts} ${t('gym.workouts').toLowerCase()}`].filter(Boolean).join(' · ');

  return (
    <>
      {/* A zero-height sticky slot: the bar hangs from it and stays on top. */}
      <div className="at-today-compact-slot">
        <motion.div
          className="at-today-compact"
          aria-hidden={!compact}
          style={{ opacity: barOpacity, y: reduce ? 0 : barY, pointerEvents: compact ? 'auto' : 'none' }}
        >
          <div className="at-today-compact-text">
            <b>{t('today.compactTitle', { done: props.done, goal: props.goal })}</b>
            <span>
              <span className="at-today-dots" aria-hidden="true">
                {props.week.map(day => (
                  <i key={day.date.toISOString()} data-done={day.done} data-today={day.isToday} />
                ))}
              </span>
              {numbers}
            </span>
          </div>
          <button className="at-today-cta-round" onClick={props.onCta} aria-label={props.ctaLabel} tabIndex={compact ? 0 : -1}>
            <Play size={18} fill="currentColor" />
          </button>
        </motion.div>
      </div>

      <motion.header ref={ref} className="at-today-head" style={{ marginTop }}>
        <div className="at-today-glow" aria-hidden="true" />
        <motion.div className="at-today-in" style={reduce ? undefined : inner}>
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
        </motion.div>
      </motion.header>
    </>
  );
};
