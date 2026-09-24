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

/** A skeleton row: blocks side by side, each a height and a share of the row. */
type Block = { h: number; w?: string; r?: number };
type Row = Block | Block[];

const card = (h: number): Block => ({ h, r: 22 });
const pair = (h: number): Block[] => [{ h, r: 22 }, { h, r: 22 }];
const line = (w: string, h = 12): Block => ({ h, w, r: 6 });

/**
 * Each screen's shape, so nothing jumps when the data lands: the blocks sit
 * where that screen's cards will.
 */
export type SkeletonShape = 'today' | 'train' | 'body' | 'library' | 'coach' | 'buddies' | 'list';

const SHAPES: Record<SkeletonShape, Row[]> = {
  today: [{ h: 250, r: 28 }, pair(104), pair(104), line('30%'), card(76)],
  train: [line('36%', 26), [{ h: 88, w: '88px', r: 22 }, { h: 88, r: 14 }], { h: 250, r: 28 }, card(52), card(52), { h: 58, r: 29 }],
  body: [line('40%'), line('55%', 34), { h: 200, r: 26 }, { h: 44, r: 22 }, pair(100)],
  library: [{ h: 48, r: 24 }, line('70%', 34), pair(150), pair(150)],
  coach: [line('40%', 34), card(120), card(90), card(90)],
  buddies: [line('40%', 34), [{ h: 64, r: 32 }, { h: 64, r: 32 }, { h: 64, r: 32 }, { h: 64, r: 32 }], card(72), card(72), card(72)],
  list: [{ h: 48, r: 24 }, card(64), card(64), card(64), card(64)],
};

/**
 * Skin-native loading placeholder, in the shape of the screen it stands in
 * for — a spinner would be the one thing that breaks the illusion. The shimmer
 * stops under reduced motion (atlas.css).
 */
export const AtlasSkeleton: React.FC<{ shape?: SkeletonShape }> = ({ shape = 'list' }) => (
  <div className="at-pad at-skeleton" aria-busy="true" data-shape={shape}>
    {SHAPES[shape].map((row, i) => (
      <div key={i} className="at-skel-rail">
        {(Array.isArray(row) ? row : [row]).map((b, j) => (
          <div
            key={j}
            className="at-skel"
            style={{ height: b.h, borderRadius: b.r ?? 14, flex: b.w ? `0 0 ${b.w}` : 1 }}
          />
        ))}
      </div>
    ))}
  </div>
);
