import React from 'react';
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { selected?: boolean; }
export const Chip: React.FC<ChipProps> = ({ selected = false, className = '', type = 'button', ...rest }) => (
  <button type={type} className={`ui-chip${selected ? ' ui-chip-selected' : ''}${className ? ` ${className}` : ''}`} aria-pressed={selected} {...rest} />
);
