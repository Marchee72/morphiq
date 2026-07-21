import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...rest }) => (
  <div className={`ui-card${className ? ` ${className}` : ''}`} {...rest} />
);
