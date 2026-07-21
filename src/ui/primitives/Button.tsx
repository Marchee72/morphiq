import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'outlined';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'filled', className = '', type = 'button', ...rest }) => (
  <button type={type} className={`ui-btn ui-btn-${variant}${className ? ` ${className}` : ''}`} {...rest} />
);
