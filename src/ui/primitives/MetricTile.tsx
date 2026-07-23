import React from 'react';

export interface MetricTileProps {
  label: string;
  valueText: string;
  icon?: React.ReactNode;
  deltaText?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  onClick?: () => void;
}

const toneColor: Record<NonNullable<MetricTileProps['deltaTone']>, string> = {
  positive: 'var(--ui-success)',
  negative: 'var(--ui-error)',
  neutral: 'var(--ui-text-secondary)',
};

/**
 * Samsung Health-style metric tile: small card with icon, big value, label, optional delta.
 * Flat tonal surface — no gradients, no glow. Uses One UI tokens.
 */
export const MetricTile: React.FC<MetricTileProps> = ({ label, valueText, icon, deltaText, deltaTone = 'neutral', onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '14px 16px',
        borderRadius: 'var(--ui-radius-card)',
        background: 'var(--ui-surface)',
        boxShadow: 'var(--ui-card-shadow)',
        border: 'none',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--ui-font)',
        color: 'var(--ui-text-primary)',
        transition: 'transform var(--ui-motion-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-secondary)' }}>{label}</span>
        {icon && <span style={{ color: 'var(--ui-on-tonal)', display: 'inline-flex' }}>{icon}</span>}
      </div>
      <strong style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{valueText}</strong>
      {deltaText && (
        <span style={{ fontSize: 11, fontWeight: 700, color: toneColor[deltaTone] }}>{deltaText}</span>
      )}
    </Tag>
  );
};