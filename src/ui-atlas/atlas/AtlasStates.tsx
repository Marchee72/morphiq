import React from 'react';

/**
 * Atlas's empty state.
 *
 * Deliberately a first-class component rather than deferred polish: the concepts
 * were designed against a user mid-session with twelve weeks of weigh-ins, and
 * the whole point of shipping both skins is to live with them from day one. A
 * screen that renders zeros and blank rails reads as broken rather than as new.
 */
export const AtlasStates: React.FC<{
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}> = ({ icon, title, body, action }) => (
  <div className="at-pad" style={{ paddingBottom: 26 }}>
    <div className="at-card at-empty">
      {icon && <span className="at-empty-icon">{icon}</span>}
      <h4>{title}</h4>
      <p>{body}</p>
      {action && (
        <button className="at-btn" onClick={action.onClick} style={{ justifyContent: 'center' }}>
          {action.label}
        </button>
      )}
    </div>
  </div>
);

/** Skin-native loading placeholder — a spinner would be the one thing that breaks the illusion. */
export const AtlasSkeleton: React.FC = () => (
  <div className="at-pad at-skeleton" aria-busy="true">
    <div className="at-skel at-skel-line" style={{ width: '40%' }} />
    <div className="at-skel at-skel-title" />
    <div className="at-skel at-skel-hero" />
    <div className="at-skel-rail">
      <div className="at-skel at-skel-moment" />
      <div className="at-skel at-skel-moment" />
    </div>
    <div className="at-skel at-skel-card" />
  </div>
);
