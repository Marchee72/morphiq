import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Dumbbell, Home, Scale, Search, Sparkles, Users } from 'lucide-react';
import { useT } from '../../i18n';
import { SCREENS, type ScreenId } from '../types';

const ICONS: Record<ScreenId, React.ReactNode> = {
  today: <Home size={18} />,
  train: <Dumbbell size={18} />,
  library: <Search size={18} />,
  body: <Scale size={18} />,
  coach: <Sparkles size={18} />,
  buddies: <Users size={18} />,
};

/** Past this many pixels sideways a press on the dock is a slide, not a tap. */
const SLIDE_PX = 8;

/**
 * The pill dock. The active item grows and reveals its label; the rest stay
 * icon-only. The ember pill is one shared `layoutId`, so it slides from tab to
 * tab rather than blinking, and the buttons animate their width (`layout`) as
 * the active one grows. Screen ids come from `SCREENS`.
 *
 * Sliding a finger along the dock scrubs through the tabs: whichever button is
 * under the finger becomes the tab, so the pill follows it. This is the only
 * place a sideways drag changes tab — on the screens themselves it belongs to
 * what is there (charts, the weight wheel, Train's exercise swipe).
 */
export const AtlasNav: React.FC<{ active: ScreenId; onNavigate: (s: ScreenId) => void }> = ({ active, onNavigate }) => {
  const { t } = useT();
  const slide = useRef<{ x: number; id: number; moved: boolean } | null>(null);
  /** A slide still ends in a click on the button under the finger; that one is swallowed. */
  const swallowClick = useRef(false);

  const tabAt = (clientX: number, nav: HTMLElement): ScreenId | null => {
    const buttons = Array.from(nav.querySelectorAll<HTMLElement>('button[data-tab]'));
    const hit = buttons.find(b => {
      const r = b.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right;
    });
    return (hit?.dataset.tab as ScreenId | undefined) ?? null;
  };

  return (
    <nav
      className="at-dock"
      onPointerDown={e => {
        slide.current = { x: e.clientX, id: e.pointerId, moved: false };
      }}
      onPointerMove={e => {
        const s = slide.current;
        if (!s || e.pointerId !== s.id) return;
        if (!s.moved) {
          if (Math.abs(e.clientX - s.x) < SLIDE_PX) return;
          s.moved = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }
        const tab = tabAt(e.clientX, e.currentTarget);
        if (tab && tab !== active) onNavigate(tab);
      }}
      onPointerUp={() => {
        if (slide.current?.moved) swallowClick.current = true;
        slide.current = null;
      }}
      onPointerCancel={() => { slide.current = null; }}
      onClickCapture={e => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {SCREENS.map(screen => (
        <motion.button
          key={screen.id}
          layout
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          data-tab={screen.id}
          data-on={active === screen.id}
          onClick={() => onNavigate(screen.id)}
          aria-label={t(screen.labelKey)}
          aria-current={active === screen.id ? 'page' : undefined}
        >
          {active === screen.id && (
            <motion.span
              layoutId="at-dock-pill"
              className="at-dock-pill"
              aria-hidden="true"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          {ICONS[screen.id]}
          {active === screen.id && <span className="at-dock-label">{t(screen.labelKey)}</span>}
        </motion.button>
      ))}
    </nav>
  );
};
