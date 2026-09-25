import React from 'react';

/** Warm gradients, picked by name so a partner keeps the same one everywhere. */
const GRADS = [
  'linear-gradient(140deg, #FFB020, #FF6A2B)',
  'linear-gradient(140deg, #FF8A5B, #D2461B)',
  'linear-gradient(140deg, #C6F24E, #7FB63A)',
  'linear-gradient(140deg, #FFD27A, #FFB020)',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * A partner's face: their picture when they have one, else their initials on
 * a gradient of their own. `live` adds the pulsing lime dot of someone
 * training right now.
 */
export const AtlasBuddyAvatar: React.FC<{ name: string; picture?: string; live?: boolean; size?: number }> = ({
  name, picture, live, size = 48,
}) => {
  const grad = GRADS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % GRADS.length];
  return (
    <span className="at-buddy-avatar" style={{ width: size, height: size, background: grad, fontSize: size * 0.34 }} aria-hidden="true">
      {picture ? <img src={picture} alt="" referrerPolicy="no-referrer" /> : initials(name)}
      {live && <i className="at-buddy-avatar-live" />}
    </span>
  );
};
