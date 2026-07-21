import React from 'react';

export interface EmptyStateProps { icon?: React.ReactNode; title: string; message?: string; action?: React.ReactNode; }

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action }) => (
  <div className="ui-empty">
    {icon && <div className="ui-empty-icon">{icon}</div>}
    <div className="ui-empty-title">{title}</div>
    {message && <div>{message}</div>}
    {action}
  </div>
);
