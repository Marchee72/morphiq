/**
 * SVG path generation for the inline trend charts both skins draw.
 *
 * Ported from the showcase helper, hardened for the real-data cases the mock
 * never hit: a single point, an empty series, and a perfectly flat series.
 */
export function sparkPath(values: number[], width: number, height: number, pad = 2): string {
  if (values.length === 0) return '';

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // a flat series draws down the middle rather than dividing by zero
  const usableHeight = height - pad * 2;
  const y = (value: number) => pad + usableHeight - ((value - min) / span) * usableHeight;

  // A one-point series has no horizontal extent; draw it as a centred hairline.
  if (values.length === 1) {
    const mid = pad + usableHeight / 2;
    return `M${pad},${mid} L${width - pad},${mid}`;
  }

  const step = (width - pad * 2) / (values.length - 1);
  return values
    .map((value, i) => `${i === 0 ? 'M' : 'L'}${(pad + i * step).toFixed(1)},${y(value).toFixed(1)}`)
    .join(' ');
}

/** The same path closed along the baseline, for the gradient fill under the line. */
export function sparkArea(values: number[], width: number, height: number, pad = 2): string {
  const line = sparkPath(values, width, height, pad);
  if (!line) return '';
  return `${line} L${width - pad},${height} L${pad},${height} Z`;
}
