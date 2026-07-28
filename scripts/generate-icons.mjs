/**
 * Generates every icon asset from the single mark definition.
 *
 * Rasterises with Playwright's Chromium rather than adding `sharp`: Playwright
 * is already a dev dependency, and one renderer for both the SVG and the PNGs
 * means the launcher icon cannot drift from what the app shows on screen.
 *
 *   node scripts/generate-icons.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

// Kept in step with src/ui-atlas/atlas/markGeometry.ts by the test in
// src/ui-atlas/__tests__/mark.test.ts, which fails if the two ever diverge.
const GEOMETRY = {
  shoulders: { x: 19, y: 11.5, width: 26, height: 6.5, rx: 3.25 },
  torso: { x: 23, y: 21, width: 18, height: 15, rx: 5 },
  legLeft: { x: 23.5, y: 39, width: 7, height: 13.5, rx: 3.5 },
  legRight: { x: 33.5, y: 39, width: 7, height: 13.5, rx: 3.5 },
};

const COLOURS = { sand: '#f3ece2', cocoa: '#2c241d', clay: '#c4643c' };
const PLATE_RADIUS = 15;

const rect = (r, fill) =>
  `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.rx}" fill="${fill}"/>`;

const figure = () => [
  rect(GEOMETRY.shoulders, COLOURS.cocoa),
  rect(GEOMETRY.torso, COLOURS.clay),
  rect(GEOMETRY.legLeft, COLOURS.cocoa),
  rect(GEOMETRY.legRight, COLOURS.cocoa),
].join('');

/**
 * @param plate 'rounded' for the web icon, 'square' for Android legacy icons
 *              (the launcher masks them itself), 'none' for adaptive foregrounds.
 */
function svg({ plate = 'rounded', scale = 1 } = {}) {
  const backdrop =
    plate === 'rounded' ? `<rect width="64" height="64" rx="${PLATE_RADIUS}" fill="${COLOURS.sand}"/>`
    : plate === 'square' ? `<rect width="64" height="64" fill="${COLOURS.sand}"/>`
    : '';

  // Adaptive foregrounds are cropped to the middle ~72%, so the figure is scaled
  // down inside the canvas or the launcher clips its head and feet off.
  const inner = scale === 1
    ? figure()
    : `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${figure()}</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${backdrop}${inner}</svg>`;
}

/** Android launcher densities: [folder, legacy icon px, adaptive layer px]. */
const DENSITIES = [
  ['mipmap-mdpi', 48, 108],
  ['mipmap-hdpi', 72, 162],
  ['mipmap-xhdpi', 96, 216],
  ['mipmap-xxhdpi', 144, 324],
  ['mipmap-xxxhdpi', 192, 432],
];

async function raster(page, markup, size, outPath) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0">${markup.replace(/width="64" height="64"/, `width="${size}" height="${size}"`)}</body></html>`,
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.locator('svg').screenshot({ path: outPath, omitBackground: true });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const written = [];

  // Web
  fs.writeFileSync(path.join(ROOT, 'public/favicon.svg'), svg({ plate: 'rounded' }));
  written.push('public/favicon.svg');

  await raster(page, svg({ plate: 'rounded' }), 512, path.join(ROOT, 'public/app_icon.png'));
  written.push('public/app_icon.png');

  // Android
  const res = path.join(ROOT, 'android/app/src/main/res');
  for (const [folder, legacy, adaptive] of DENSITIES) {
    await raster(page, svg({ plate: 'square' }), legacy, path.join(res, folder, 'ic_launcher.png'));
    await raster(page, svg({ plate: 'rounded' }), legacy, path.join(res, folder, 'ic_launcher_round.png'));
    await raster(page, svg({ plate: 'none', scale: 0.62 }), adaptive, path.join(res, folder, 'ic_launcher_foreground.png'));
    written.push(`${folder}/ (3 files)`);
  }

  // The adaptive background is a flat colour, so it stays a vector.
  fs.writeFileSync(
    path.join(res, 'drawable/ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n    <solid android:color="${COLOURS.sand}" />\n</shape>\n`,
  );
  written.push('drawable/ic_launcher_background.xml');

  // The v24 vector foreground would win over our PNGs on API 24+; remove it so
  // every density uses the generated asset.
  const staleForeground = path.join(res, 'drawable-v24/ic_launcher_foreground.xml');
  if (fs.existsSync(staleForeground)) {
    fs.rmSync(staleForeground);
    written.push('removed drawable-v24/ic_launcher_foreground.xml');
  }

  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    fs.writeFileSync(
      path.join(res, 'mipmap-anydpi-v26', name),
      `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@drawable/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`,
    );
    written.push(`mipmap-anydpi-v26/${name}`);
  }

  await browser.close();
  console.log('Generated:\n  ' + written.join('\n  '));
}

main().catch(err => { console.error(err); process.exit(1); });
