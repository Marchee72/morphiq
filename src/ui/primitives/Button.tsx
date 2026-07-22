import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'outlined' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'filled', size, className = '', type = 'button', style, ...rest }) => (
  <button
    type={type}
    className={`ui-btn ui-btn-${variant}${className ? ` ${className}` : ''}`}
    style={{
      ...(size === 'sm' ? { fontSize: 12, padding: '6px 12px' } : {}),
      ...style,
    }}
    {...rest}
  />
);
