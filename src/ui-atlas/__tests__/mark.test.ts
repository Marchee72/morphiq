import { describe, expect, it } from 'vitest';
// `?raw` rather than `fs`: the app's tsconfig has no Node types, and Vite
// inlines the file at build time either way.
import SCRIPT from '../../../scripts/generate-icons.mjs?raw';
import { MARK_COLOURS, MARK_GEOMETRY, MARK_PLATE_RADIUS, markSvg } from '../atlas/markGeometry';

/**
 * The icon generator carries its own copy of the geometry — it runs in plain
 * Node, outside the TypeScript build, so it cannot import the module. This test
 * is what stops the two drifting: change the mark and forget the script, and
 * the launcher icon silently stays the old shape.
 */
function geometryFromScript(): typeof MARK_GEOMETRY {
  const block = /const GEOMETRY = \{([\s\S]*?)\n\};/.exec(SCRIPT);
  if (!block) throw new Error('GEOMETRY not found in generate-icons.mjs');
  // The literal is plain JS with unquoted keys; evaluate it rather than parse.
  return Function(`return {${block[1]}}`)();
}

describe('mark geometry', () => {
  it('matches the copy inside the icon generator', () => {
    expect(geometryFromScript()).toEqual(MARK_GEOMETRY);
  });

  it('keeps the palette in step with the generator', () => {
    for (const [name, value] of Object.entries(MARK_COLOURS)) {
      expect(SCRIPT, `${name} differs`).toContain(value);
    }
    expect(SCRIPT).toContain(`PLATE_RADIUS = ${MARK_PLATE_RADIUS}`);
  });

  it('stays inside the 64-unit canvas', () => {
    for (const [name, r] of Object.entries(MARK_GEOMETRY)) {
      expect(r.x, name).toBeGreaterThanOrEqual(0);
      expect(r.y, name).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width, name).toBeLessThanOrEqual(64);
      expect(r.y + r.height, name).toBeLessThanOrEqual(64);
    }
  });

  it('is vertically centred, so it does not sit high in a launcher', () => {
    const top = MARK_GEOMETRY.shoulders.y;
    const bottom = MARK_GEOMETRY.legLeft.y + MARK_GEOMETRY.legLeft.height;
    expect(Math.abs(top - (64 - bottom))).toBeLessThanOrEqual(1);
  });

  it('tapers from shoulders to legs, which is what reads as a body', () => {
    const legs = MARK_GEOMETRY.legRight.x + MARK_GEOMETRY.legRight.width - MARK_GEOMETRY.legLeft.x;
    expect(MARK_GEOMETRY.shoulders.width).toBeGreaterThan(MARK_GEOMETRY.torso.width);
    expect(MARK_GEOMETRY.torso.width).toBeGreaterThanOrEqual(legs);
  });

  it('emits valid standalone SVG for both variants', () => {
    expect(markSvg()).toContain(MARK_COLOURS.sand);
    expect(markSvg({ withPlate: false })).not.toContain(`rx="${MARK_PLATE_RADIUS}"`);
    for (const svg of [markSvg(), markSvg({ withPlate: false })]) {
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
    }
  });
});
