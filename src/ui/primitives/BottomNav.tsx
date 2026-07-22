import React from 'react';

export interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ items, activeId, onSelect }) => (
  <nav className="ui-bottomnav" aria-label="Main navigation">
    {items.map(item => {
      const active = item.id === activeId;
      return (
        <button
          key={item.id}
          type="button"
          className={`ui-bottomnav-item${active ? ' active' : ''}`}
          aria-current={active ? 'page' : undefined}
          aria-label={item.label}
          onClick={() => onSelect(item.id)}
        >
          <span className="ui-bottomnav-icon-wrap">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      );
    })}
  </nav>
);
