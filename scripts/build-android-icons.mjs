#!/usr/bin/env node
/**
 * Generates the Android launcher icons and splash images in `android/app/src/main/res/` from the
 * brand icon ("drop and sprout", shared artwork in `scripts/brand-icon.mjs`):
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
import { ADAPTIVE_BACKGROUND, foregroundSvg, iconInner, iconSvg } from './brand-icon.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android/app/src/main/res');
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const PAPER = '#f8f5ef'; // --color-bg (light)

/** Splash: paper background with the rounded icon centred (28 % of the short side). */
function splashSvg(w, h) {
  const mark = Math.round(Math.min(w, h) * 0.28);
  const x = (w - mark) / 2;
  const y = (h - mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${PAPER}"/>
  <g transform="translate(${x} ${y}) scale(${mark / 512})">${iconInner({ id: 's', shape: 'rounded', glyphScale: 1 })}</g></svg>`;
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
    svg: iconSvg({ id: 'l', shape: 'rounded', glyphScale: 1 }),
    w: 48 * k,
    h: 48 * k,
  });
  targets.push({
    file: `mipmap-${d}/ic_launcher_round.png`,
    svg: iconSvg({ id: 'c', shape: 'circle', glyphScale: 0.92 }),
    w: 48 * k,
    h: 48 * k,
  });
  targets.push({
    file: `mipmap-${d}/ic_launcher_foreground.png`,
    svg: foregroundSvg(0.78),
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
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ADAPTIVE_BACKGROUND.toUpperCase()}</color>\n</resources>\n`,
);
console.log('✓ values/ic_launcher_background.xml');
