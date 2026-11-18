#!/usr/bin/env node
/**
 * Generates the PWA icons in `public/` from an inline SVG ("drop and sprout": white droplet with a sprout cut-out on an apricot square, see brand-icon.mjs):
 *   favicon.svg, pwa-192x192.png, pwa-512x512.png, maskable-512x512.png, apple-touch-icon.png (180).
 * Rasterised with headless Chromium via playwright-core (CHROMIUM_PATH or /opt/pw-browsers/chromium).
 * Usage: `npm run icons`. Output is committed; the build does not run this.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { iconSvg } from './brand-icon.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public');
const EXECUTABLE = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const roundedSvg = iconSvg({ id: 'r', shape: 'rounded', glyphScale: 1 });
const faviconSvg = iconSvg({ id: 'f', shape: 'rounded', glyphScale: 1.08 });
// Maskable safe zone is the central 80 % circle → shrink the glyph.
const maskableSvg = iconSvg({ id: 'm', shape: 'square', glyphScale: 0.8 });
const appleSvg = iconSvg({ id: 'a', shape: 'square', glyphScale: 0.9 });

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
