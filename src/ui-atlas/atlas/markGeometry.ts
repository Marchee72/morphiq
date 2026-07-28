/**
 * The shape of the MorphIQ mark, as data.
 *
 * Kept apart from the component so the icon-generation script can import it
 * without pulling React in, and so `AppMark.tsx` exports only a component (which
 * is what Fast Refresh needs to hot-reload it).
 *
 * This is the single source of truth: the favicon, the 512px app icon and every
 * Android density are rasterised from these numbers, so the mark cannot drift
 * between platforms.
 */
/**
 * Proportions matter more than detail. Two earlier passes failed at small
 * sizes: 12-unit legs under a 17-unit torso read as a t-shirt over two dots,
 * and 32-unit shoulders against a 16-unit torso made the bar dominate
 * everything. The taper is now 26 → 18 → 17, and the figure is centred on the
 * 64-unit box (11.5 above, 11.5 below) so it does not sit high in a launcher.
 */
export const MARK_GEOMETRY = {
  shoulders: { x: 19, y: 11.5, width: 26, height: 6.5, rx: 3.25 },
  torso: { x: 23, y: 21, width: 18, height: 15, rx: 5 },
  legLeft: { x: 23.5, y: 39, width: 7, height: 13.5, rx: 3.5 },
  legRight: { x: 33.5, y: 39, width: 7, height: 13.5, rx: 3.5 },
} as const;

export const MARK_COLOURS = {
  sand: '#f3ece2',
  cocoa: '#2c241d',
  clay: '#c4643c',
} as const;

/** Corner radius of the icon plate, in the 64-unit viewBox. */
export const MARK_PLATE_RADIUS = 15;

/** The mark as standalone SVG, used to generate every raster asset. */
export function markSvg({ withPlate = true, size = 64 }: { withPlate?: boolean; size?: number } = {}): string {
  const g = MARK_GEOMETRY;
  const rect = (r: { x: number; y: number; width: number; height: number; rx: number }, fill: string) =>
    `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.rx}" fill="${fill}"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">`,
    withPlate
      ? `<rect x="0" y="0" width="64" height="64" rx="${MARK_PLATE_RADIUS}" fill="${MARK_COLOURS.sand}"/>`
      : '',
    rect(g.shoulders, MARK_COLOURS.cocoa),
    rect(g.torso, MARK_COLOURS.clay),
    rect(g.legLeft, MARK_COLOURS.cocoa),
    rect(g.legRight, MARK_COLOURS.cocoa),
    '</svg>',
  ].join('');
}
