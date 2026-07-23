import React from 'react';
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { selected?: boolean; size?: 'sm' | 'md'; }
export const Chip: React.FC<ChipProps> = ({ selected = false, size, className = '', type = 'button', style, ...rest }) => (
  <button
    type={type}
    className={`ui-chip${selected ? ' ui-chip-selected' : ''}${className ? ` ${className}` : ''}`}
    aria-pressed={selected}
    style={{
      ...(size === 'sm' ? { fontSize: 11, padding: '2px 8px', borderRadius: 999 } : {}),
      ...style,
    }}
    {...rest}
  />
);
