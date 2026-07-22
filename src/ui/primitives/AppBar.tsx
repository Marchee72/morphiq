import React, { useEffect, useState } from 'react';

export interface AppBarProps {
  title: string;
  overline?: string;
  actions?: React.ReactNode;
}

const COLLAPSE_THRESHOLD = 24;
const EXPAND_THRESHOLD = 24;

export const AppBar: React.FC<AppBarProps> = ({ title, overline, actions }) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCollapsed(prev => {
        if (!prev && y > COLLAPSE_THRESHOLD) return true;
        if (prev && y < EXPAND_THRESHOLD) return false;
        return prev;
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`ui-appbar${collapsed ? ' collapsed' : ''}`}>
      <div className="ui-appbar-titles">
        {overline && <span className="ui-appbar-overline">{overline}</span>}
        <h1 className="ui-appbar-title">{title}</h1>
      </div>
      {actions && <div className="ui-appbar-actions">{actions}</div>}
    </header>
  );
};
