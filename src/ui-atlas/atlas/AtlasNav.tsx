import React from 'react';
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

/**
 * The pill dock. The active item grows and reveals its label; the rest stay
 * icon-only. The ember pill is one shared `layoutId`, so it slides from tab to
 * tab rather than blinking, and the buttons animate their width (`layout`) as
 * the active one grows. Screen ids come from `SCREENS`.
 */
export const AtlasNav: React.FC<{ active: ScreenId; onNavigate: (s: ScreenId) => void }> = ({ active, onNavigate }) => {
  const { t } = useT();
  return (
    <nav className="at-dock">
      {SCREENS.map(screen => (
        <motion.button
          key={screen.id}
          layout
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
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
