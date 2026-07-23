import React from 'react';

export interface CategoryTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface CategoryToolbarProps {
  tabs: CategoryTab[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * Samsung Health-style top category toolbar.
 * Pill-shaped segmented control for switching between health pillars.
 */
export const CategoryToolbar: React.FC<CategoryToolbarProps> = ({ tabs, activeId, onSelect }) => (
  <div style={{
    display: 'flex',
    gap: 2,
    background: 'var(--ui-surface-dim)',
    borderRadius: 'var(--ui-radius-pill)',
    padding: 4,
    overflow: 'hidden',
    width: '100%',
    boxSizing: 'border-box',
  }}>
    {tabs.map((t: CategoryTab) => {
      const active = t.id === activeId;
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          style={{
            flex: '1 1 0%',
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '8px 4px',
            borderRadius: 'var(--ui-radius-pill)',
            border: 'none',
            background: active ? 'var(--ui-surface)' : 'transparent',
            color: active ? 'var(--ui-text-primary)' : 'var(--ui-text-secondary)',
            fontFamily: 'var(--ui-font)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: active ? 'var(--ui-card-shadow)' : 'none',
            whiteSpace: 'nowrap',
            transition: 'background-color var(--ui-motion-fast), color var(--ui-motion-fast)',
          }}
        >
          {t.icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
        </button>
      );
    })}
  </div>
);