import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'filled', size, className = '', type = 'button', style, ...rest }) => (
  <button
    type={type}
    className={`ui-btn ui-btn-${variant}${className ? ` ${className}` : ''}`}
    style={{
      ...(size === 'sm' ? { fontSize: 'var(--ui-text-label)', padding: 'var(--ui-space-2) var(--ui-space-3)', minHeight: 36 } : {}),
      ...(size === 'lg' ? { minHeight: 56, padding: '14px 28px' } : {}),
      ...style,
    }}
    {...rest}
  />
);
