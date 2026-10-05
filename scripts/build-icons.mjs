#!/usr/bin/env node
/**
 * Generates the PWA icons in `public/` from an inline SVG (baby bottle on a teal rounded square):
 *   favicon.svg, pwa-192x192.png, pwa-512x512.png, maskable-512x512.png, apple-touch-icon.png (180).
 * Rasterised with headless Chromium via playwright-core (CHROMIUM_PATH or /opt/pw-browsers/chromium).
 * Usage: `npm run icons`. Output is committed; the build does not run this.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const TEAL_TOP = '#36A193';
const TEAL_BOTTOM = '#2A8276';
const MILK = '#E3F3EF';
const INK = '#2F8F83';

/** The bottle glyph, drawn on a 512×512 canvas centred around (256, 260). */
const glyph = `
  <path d="M220 182c0-30 16-44 25-60 4-8 5-22 11-22s7 14 11 22c9 16 25 30 25 60z" fill="#fff"/>
  <rect x="174" y="176" width="164" height="42" rx="16" fill="#fff"/>
  <rect x="190" y="226" width="132" height="200" rx="44" fill="#fff"/>
  <path d="M190 318h132v64c0 24-20 44-44 44h-44c-24 0-44-20-44-44z" fill="${MILK}"/>
  <g stroke="${INK}" stroke-width="10" stroke-linecap="round">
    <path d="M212 268h34M212 302h22M212 336h34"/>
  </g>
  <rect x="174" y="176" width="164" height="42" rx="16" fill="none" stroke="${INK}" stroke-opacity=".18" stroke-width="4"/>`;

/**
 * @param {{ rounded: boolean; glyphScale: number }} opts
 *   rounded=false → full-bleed square (maskable / apple-touch, where the OS applies the mask).
 */
function iconSvg({ rounded, glyphScale }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TEAL_TOP}"/>
      <stop offset="1" stop-color="${TEAL_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${glyphScale}) translate(-256 -263)">${glyph}
  </g>
</svg>
`;
}

const roundedSvg = iconSvg({ rounded: true, glyphScale: 1 });
// Maskable safe zone is the central 80 % circle → shrink the glyph.
const maskableSvg = iconSvg({ rounded: false, glyphScale: 0.78 });
const appleSvg = iconSvg({ rounded: false, glyphScale: 0.86 });

const targets = [
  { file: 'pwa-192x192.png', svg: roundedSvg, size: 192 },
  { file: 'pwa-512x512.png', svg: roundedSvg, size: 512 },
  { file: 'maskable-512x512.png', svg: maskableSvg, size: 512 },
  { file: 'apple-touch-icon.png', svg: appleSvg, size: 180 },
];

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'favicon.svg'), roundedSvg);
console.log('✓ favicon.svg');

const browser = await chromium.launch({ executablePath: EXECUTABLE });
try {
  const page = await browser.newPage();
  for (const { file, svg, size } of targets) {
    await page.setViewportSize({ width: size, height: size });
    const sized = svg.replace('width="512" height="512"', `width="${size}" height="${size}"`);
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`,
    );
    const png = await page.locator('svg').screenshot({ omitBackground: true });
    writeFileSync(join(OUT, file), png);
    console.log(`✓ ${file} (${size}×${size}, ${png.length} bytes)`);
  }
} finally {
  await browser.close();
}
