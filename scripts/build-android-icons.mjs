#!/usr/bin/env node
/**
 * Generates the Android launcher icons and splash images in `android/app/src/main/res/` from the
 * brand mark (white droplet on the teal square, same artwork as `scripts/build-icons.mjs`):
 *   mipmap-*\/ic_launcher.png, ic_launcher_round.png (legacy, pre-Android 8),
 *   mipmap-*\/ic_launcher_foreground.png (adaptive icon foreground; background is a color resource),
 *   drawable*\/splash.png (pre-Android 12 launch screen; 12+ uses the adaptive icon).
 * Rasterised with headless Chromium via playwright-core (CHROMIUM_PATH or /opt/pw-browsers/chromium).
 * Usage: `npm run icons:android` after `cap add android`. Output is committed.
 */
import { writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android/app/src/main/res');
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const PRIMARY = '#2a746c';
const PRIMARY_LIGHT = '#558f89';
const PAPER = '#f8f5ef'; // --color-bg (light)
const DROPLET =
  'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z';

const gradient = `<linearGradient id="bg" x1="0.21" y1="0.09" x2="0.79" y2="0.91">
  <stop offset="0" stop-color="${PRIMARY_LIGHT}"/><stop offset="1" stop-color="${PRIMARY}"/>
</linearGradient>`;

/** Droplet glyph centred in a `box`-sized square at (x, y), as a 24-unit lucide icon. */
function droplet(x, y, box) {
  const k = box / 24;
  return `<g transform="translate(${x} ${y + box / 72}) scale(${k})">
  <path d="${DROPLET}" fill="none" stroke="#ffffff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
</g>`;
}

/** Legacy launcher icon: rounded square or circle, glyph at 56 % like the PWA icon. */
function legacySvg(round) {
  const shape = round
    ? `<circle cx="256" cy="256" r="256" fill="url(#bg)"/>`
    : `<rect width="512" height="512" rx="112" fill="url(#bg)"/>`;
  const box = round ? 260 : 288;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${gradient}</defs>${shape}${droplet((512 - box) / 2, (512 - box) / 2, box)}</svg>`;
}

/** Adaptive foreground (108dp canvas, 66dp safe zone): transparent, glyph ~44 % of the canvas. */
function foregroundSvg() {
  const box = 512 * 0.44;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${droplet((512 - box) / 2, (512 - box) / 2, box)}</svg>`;
}

/** Splash: paper background with the rounded brand mark centred (a quarter of the short side). */
function splashSvg(w, h) {
  const mark = Math.round(Math.min(w, h) * 0.28);
  const x = (w - mark) / 2;
  const y = (h - mark) / 2;
  const box = mark * 0.5625;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs>${gradient}</defs>
  <rect width="${w}" height="${h}" fill="${PAPER}"/>
  <rect x="${x}" y="${y}" width="${mark}" height="${mark}" rx="${mark * 0.22}" fill="url(#bg)"/>
  ${droplet(x + (mark - box) / 2, y + (mark - box) / 2, box)}</svg>`;
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SPLASH_PORT = {
  mdpi: [320, 480],
  hdpi: [480, 800],
  xhdpi: [720, 1280],
  xxhdpi: [960, 1600],
  xxxhdpi: [1280, 1920],
};

if (!existsSync(RES)) {
  console.error('android/ not found — run `npx cap add android` first.');
  process.exit(1);
}

const targets = [];
for (const [d, k] of Object.entries(DENSITIES)) {
  targets.push({
    file: `mipmap-${d}/ic_launcher.png`,
    svg: legacySvg(false),
    w: 48 * k,
    h: 48 * k,
  });
  targets.push({
    file: `mipmap-${d}/ic_launcher_round.png`,
    svg: legacySvg(true),
    w: 48 * k,
    h: 48 * k,
  });
  targets.push({
    file: `mipmap-${d}/ic_launcher_foreground.png`,
    svg: foregroundSvg(),
    w: 108 * k,
    h: 108 * k,
  });
  const [pw, ph] = SPLASH_PORT[d];
  targets.push({ file: `drawable-port-${d}/splash.png`, svg: splashSvg(pw, ph), w: pw, h: ph });
  targets.push({ file: `drawable-land-${d}/splash.png`, svg: splashSvg(ph, pw), w: ph, h: pw });
}
targets.push({ file: 'drawable/splash.png', svg: splashSvg(480, 320), w: 480, h: 320 });

const browser = await chromium.launch({ executablePath: EXECUTABLE });
try {
  const page = await browser.newPage();
  for (const { file, svg, w, h } of targets) {
    await page.setViewportSize({ width: w, height: h });
    const sized = svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`,
    );
    const png = await page.locator('svg').screenshot({ omitBackground: true });
    writeFileSync(join(RES, file), png);
    console.log(`✓ ${file} (${w}×${h})`);
  }
} finally {
  await browser.close();
}

// Adaptive icon background (Android 8+) is a flat color resource.
writeFileSync(
  join(RES, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${PRIMARY.toUpperCase()}</color>\n</resources>\n`,
);
console.log('✓ values/ic_launcher_background.xml');
