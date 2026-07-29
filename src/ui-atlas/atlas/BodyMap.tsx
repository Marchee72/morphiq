import React from 'react';
import type { MuscleGroupId } from '../types';

export type Side = 'front' | 'back';

interface Region {
  id: MuscleGroupId;
  shape: React.ReactNode;
}

/**
 * The tappable body map — Atlas's way into the catalogue.
 *
 * Region ids are real muscle-group ids, so a tap maps straight through
 * `GROUP_TO_CATEGORIES` into a catalogue filter. The concept used an identity
 * map between region names and category names, which only worked because its
 * mock catalogue invented matching categories; the real dataset uses
 * "upper legs" / "lower legs" / "waist" and needs the translation.
 */
const FRONT_REGIONS: Region[] = [
  { id: 'shoulders', shape: <><ellipse cx="33" cy="46" rx="13" ry="9" /><ellipse cx="87" cy="46" rx="13" ry="9" /></> },
  { id: 'chest', shape: <rect x="40" y="37" width="40" height="27" rx="11" /> },
  { id: 'arms', shape: <><rect x="21" y="54" width="13" height="52" rx="6.5" /><rect x="86" y="54" width="13" height="52" rx="6.5" /></> },
  { id: 'core', shape: <rect x="44" y="67" width="32" height="31" rx="9" /> },
  { id: 'legs', shape: <><rect x="43" y="102" width="16" height="74" rx="8" /><rect x="61" y="102" width="16" height="74" rx="8" /></> },
];

const BACK_REGIONS: Region[] = [
  { id: 'shoulders', shape: <><ellipse cx="33" cy="46" rx="13" ry="9" /><ellipse cx="87" cy="46" rx="13" ry="9" /></> },
  { id: 'back', shape: <rect x="40" y="37" width="40" height="45" rx="11" /> },
  { id: 'arms', shape: <><rect x="21" y="54" width="13" height="52" rx="6.5" /><rect x="86" y="54" width="13" height="52" rx="6.5" /></> },
  { id: 'legs', shape: <><rect x="43" y="86" width="16" height="90" rx="8" /><rect x="61" y="86" width="16" height="90" rx="8" /></> },
];

const REGIONS: Record<Side, Region[]> = { front: FRONT_REGIONS, back: BACK_REGIONS };

/**
 * The body behind the regions.
 *
 * The regions are separate rects and ellipses with gaps between them, and the
 * map sits on a near-white card — so picking one used to draw a clay shape with
 * a white halo where the card showed through. This layer fills the union of both
 * sides' geometry, slightly outset, so those gaps read as body rather than page.
 * One shape covers front and back: the torso runs to the front's core, the lower
 * block starts at the back's higher leg line, and each side's regions paint over
 * whichever part of it they cover.
 */
const SILHOUETTE = (
  <g className="at-map-figure" aria-hidden="true">
    <ellipse cx="33" cy="46" rx="14" ry="10" />
    <ellipse cx="87" cy="46" rx="14" ry="10" />
    <rect x="20" y="46" width="15" height="61" rx="7.5" />
    <rect x="85" y="46" width="15" height="61" rx="7.5" />
    <rect x="39" y="36" width="42" height="67" rx="12" />
    <rect x="42" y="84" width="36" height="93" rx="9" />
  </g>
);

export const BodyMap: React.FC<{
  side: Side;
  active: MuscleGroupId | null;
  onPick: (id: MuscleGroupId) => void;
}> = ({ side, active, onPick }) => (
  <svg viewBox="0 0 120 186" width="96" height="150" role="group" aria-label="body map">
    <circle cx="60" cy="16" r="13" fill="var(--at-figure-skin)" />
    <rect x="54" y="27" width="12" height="9" rx="4" fill="var(--at-figure-skin)" />
    {SILHOUETTE}
    {REGIONS[side].map(region => (
      <g
        key={region.id}
        className="at-map-region"
        data-on={active === region.id}
        onClick={() => onPick(region.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onPick(region.id); }}
      >
        {region.shape}
      </g>
    ))}
  </svg>
);
