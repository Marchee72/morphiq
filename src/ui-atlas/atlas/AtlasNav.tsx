import React from 'react';
import { Dumbbell, Home, Scale, Search, Sparkles } from 'lucide-react';
import { useT } from '../../i18n';
import { SCREENS, type ScreenId } from '../types';

const ICONS: Record<ScreenId, React.ReactNode> = {
  today: <Home size={18} />,
  train: <Dumbbell size={18} />,
  library: <Search size={18} />,
  body: <Scale size={18} />,
  coach: <Sparkles size={18} />,
};

/**
 * The pill dock. The active item grows and reveals its label; the rest stay
 * icon-only. Screen ids come from `SCREENS` rather than a local copy, which the
 * concept duplicated.
 */
export const AtlasNav: React.FC<{ active: ScreenId; onNavigate: (s: ScreenId) => void }> = ({ active, onNavigate }) => {
  const { t } = useT();
  return (
    <nav className="at-dock">
      {SCREENS.map(screen => (
        <button
          key={screen.id}
          data-on={active === screen.id}
          onClick={() => onNavigate(screen.id)}
          aria-label={t(screen.labelKey)}
          aria-current={active === screen.id ? 'page' : undefined}
        >
          {ICONS[screen.id]}
          {active === screen.id && <span>{t(screen.labelKey)}</span>}
        </button>
      ))}
    </nav>
  );
};
