#!/usr/bin/env node
/**
 * Generates the PWA icons in `public/` from an inline SVG (white droplet on the teal brand-mark square):
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

/**
 * Brand mark (DESIGN §6.24 `.brand-mark`): `--color-primary` (#2a746c) gradient square at 145°,
 * starting from primary mixed 80 % with white, with a white lucide `droplet` (stroke 1.75).
 */
const PRIMARY = '#2a746c';
const PRIMARY_LIGHT = '#558f89'; // color-mix(in srgb, #2a746c 80%, #fff)

/** lucide `droplet` path (24×24 viewBox). */
const DROPLET =
  'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z';

/**
 * @param {{ rounded: boolean; glyphScale: number; filled?: boolean }} opts
 *   rounded=false → full-bleed square (maskable / apple-touch, where the OS applies the mask).
 *   filled → solid droplet (legible at favicon sizes).
 */
function iconSvg({ rounded, glyphScale, filled = false }) {
  // Glyph box is 288px (36/64 of the mark, as in .brand-mark) scaled by glyphScale.
  const size = 288 * glyphScale;
  const k = size / 24;
  const offset = (512 - size) / 2;
  const stroke = filled ? 'none' : '#ffffff';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0.21" y1="0.09" x2="0.79" y2="0.91">
      <stop offset="0" stop-color="${PRIMARY_LIGHT}"/>
      <stop offset="1" stop-color="${PRIMARY}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 160 : 0}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset + 4 * glyphScale}) scale(${k})">
    <path d="${DROPLET}" fill="${filled ? '#ffffff' : 'none'}" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;
}

const roundedSvg = iconSvg({ rounded: true, glyphScale: 1 });
const faviconSvg = iconSvg({ rounded: true, glyphScale: 1.05, filled: true });
// Maskable safe zone is the central 80 % circle → shrink the glyph.
const maskableSvg = iconSvg({ rounded: false, glyphScale: 0.8 });
const appleSvg = iconSvg({ rounded: false, glyphScale: 0.9 });

const targets = [
  { file: 'pwa-192x192.png', svg: roundedSvg, size: 192 },
  { file: 'pwa-512x512.png', svg: roundedSvg, size: 512 },
  { file: 'maskable-512x512.png', svg: maskableSvg, size: 512 },
  { file: 'apple-touch-icon.png', svg: appleSvg, size: 180 },
];

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'favicon.svg'), faviconSvg);
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
