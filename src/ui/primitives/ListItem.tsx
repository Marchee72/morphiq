import React from 'react';
export interface ListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon?: React.ReactNode; title: string; subtitle?: string; trailing?: React.ReactNode; }
export const ListItem: React.FC<ListItemProps> = ({ icon, title, subtitle, trailing, type = 'button', ...rest }) => (
  <button type={type} className="ui-list-item" {...rest}>
    {icon && <span className="ui-list-item-icon">{icon}</span>}
    <span className="ui-list-item-text"><span>{title}</span>{subtitle && <span className="ui-list-item-sub">{subtitle}</span>}</span>
    {trailing && <span className="ui-list-item-trailing">{trailing}</span>}
  </button>
);
