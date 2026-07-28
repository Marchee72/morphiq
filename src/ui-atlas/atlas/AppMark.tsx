import React from 'react';
import { MARK_COLOURS, MARK_GEOMETRY, MARK_PLATE_RADIUS } from './markGeometry';

/**
 * The MorphIQ mark: an abstract body reduced to three shapes.
 *
 * Shoulders, torso, legs — the same taper as the body map on the Library screen,
 * stripped to what still reads at 24px in a launcher. The torso carries the clay
 * accent because it is the one shape the eye lands on first.
 *
 * Geometry lives in `markGeometry.ts` so the icon-generation script shares it.
 */
export const AppMark: React.FC<{
  size?: number;
  /** `icon` paints the sand plate behind the figure; `mark` is transparent. */
  variant?: 'icon' | 'mark';
  className?: string;
  title?: string;
}> = ({ size = 48, variant = 'icon', className, title }) => {
  const g = MARK_GEOMETRY;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {variant === 'icon' && (
        <rect x="0" y="0" width="64" height="64" rx={MARK_PLATE_RADIUS} fill={MARK_COLOURS.sand} />
      )}
      <rect {...g.shoulders} fill={MARK_COLOURS.cocoa} />
      <rect {...g.torso} fill={MARK_COLOURS.clay} />
      <rect {...g.legLeft} fill={MARK_COLOURS.cocoa} />
      <rect {...g.legRight} fill={MARK_COLOURS.cocoa} />
    </svg>
  );
};
