import React from 'react';
import { Sheet } from './Sheet';

export interface QuickAddAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  actions: QuickAddAction[];
}

export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({ open, onClose, actions }) => (
  <Sheet open={open} onClose={onClose} title="Quick add">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8 }}>
      {actions.map(a => (
        <button
          key={a.id}
          type="button"
          className="ui-list-item"
          onClick={() => { a.onClick(); onClose(); }}
        >
          <span className="ui-list-item-icon">{a.icon}</span>
          <span className="ui-list-item-text">
            <span>{a.label}</span>
          </span>
        </button>
      ))}
    </div>
  </Sheet>
);
