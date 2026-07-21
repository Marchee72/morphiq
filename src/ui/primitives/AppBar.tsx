import React, { useEffect, useState } from 'react';

export interface AppBarProps {
  title: string;
  overline?: string;
  actions?: React.ReactNode;
}

const COLLAPSE_THRESHOLD = 24;

export const AppBar: React.FC<AppBarProps> = ({ title, overline, actions }) => {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > COLLAPSE_THRESHOLD);
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
