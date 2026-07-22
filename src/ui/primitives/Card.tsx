import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'tonal' | 'outlined';
  padding?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ variant = 'surface', padding, className = '', style, ...rest }) => (
  <div
    className={`ui-card ui-card-${variant}${className ? ` ${className}` : ''}`}
    style={{
      ...(padding === 'sm' ? { padding: 12 } : padding === 'md' ? { padding: 16 } : {}),
      ...style,
    }}
    {...rest}
  />
);
