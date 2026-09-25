// Checks WCAG AA (4.5:1) for every text/background pair the palette promises,
// in both modes, reading the values straight out of atlas.css so the numbers
// in its comments cannot drift from the colours. `npm run check:contrast`.
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/ui-atlas/atlas/atlas.css', import.meta.url), 'utf8');

function block(selectorStart) {
  const at = css.indexOf(selectorStart);
  if (at < 0) throw new Error(`no block ${selectorStart}`);
  return css.slice(at, css.indexOf('}', at));
}

/** `--name: value` pairs of one palette block. */
function tokens(text) {
  const out = {};
  for (const m of text.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = tokens(block(".at[data-mode='light'] {"));
const dark = { ...light, ...tokens(block(".at[data-mode='dark'] {")) };

function rgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map(c => c + c).join('') : h;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = rgb(hex).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every hex stop of a value — one for a flat colour, each stop for a gradient. */
const stops = value => value.match(/#[0-9a-f]{3,6}\b/gi) ?? [];

// [text token, background token] — a gradient background is checked at every stop.
const PAIRS = [
  ['cocoa', 'sand'], ['cocoa', 'card'], ['muted', 'sand'], ['muted', 'card'],
  ['clay', 'sand'], ['at-on-clay', 'clay'], ['at-on-clay', 'd-grad'],
  ['cocoa', 'd-tonal'], ['cocoa', 'd-pill'], ['cocoa', 'd-card'], ['muted', 'd-card'],
  ['sage', 'at-sage-bg'], ['lime-ink', 'lime'],
  ['at-on-clay', 'at-effort-1'], ['at-on-clay', 'at-effort-2'], ['at-on-clay', 'at-effort-3'],
  ['at-on-clay', 'at-effort-4'], ['at-on-clay', 'at-effort-5'],
];
// White on the danger gradient is written as a literal, not a token.
const LITERAL = [['#ffffff', 'd-danger']];

let failed = 0;
for (const [mode, t] of [['light', light], ['dark', dark]]) {
  const check = (fgHex, fgName, bgName) => {
    for (const bg of stops(t[bgName])) {
      const r = ratio(fgHex, bg);
      if (r < 4.5) {
        failed++;
        console.log(`FAIL ${mode}: ${fgName} ${fgHex} on ${bgName} ${bg} = ${r.toFixed(2)}:1`);
      }
    }
  };
  for (const [fg, bg] of PAIRS) check(stops(t[fg])[0], fg, bg);
  for (const [fg, bg] of LITERAL) check(fg, fg, bg);
}

if (failed) {
  console.log(`${failed} pair(s) below 4.5:1`);
  process.exit(1);
}
console.log(`All ${(PAIRS.length + LITERAL.length) * 2} pairs pass AA in light and dark.`);
