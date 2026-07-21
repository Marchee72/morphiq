import React from 'react';

export interface RingProps {
  value: number; size?: number; stroke?: number; label?: string; valueText?: string;
}

export const Ring: React.FC<RingProps> = ({ value, size = 72, stroke = 8, label, valueText }) => {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <span className="ui-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={label ?? 'progress'}>
        <circle cx={center} cy={center} r={radius} stroke="var(--ui-surface-dim)" strokeWidth={stroke} fill="none" />
        <circle cx={center} cy={center} r={radius} stroke="var(--ui-primary)" strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`} />
      </svg>
      <span className="ui-ring-center">
        {valueText && <strong>{valueText}</strong>}
        {label && <small>{label}</small>}
      </span>
    </span>
  );
};
