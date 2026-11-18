/**
 * The app icon ("Drop and sprout", option C): a white milk droplet with a small sprout cut out of
 * it — feeding + growth — on a warm apricot gradient. Shared by `build-icons.mjs` (PWA) and
 * `build-android-icons.mjs` (launcher icons + splash). All artwork lives in a 512×512 space.
 */

export const APRICOT_LIGHT = '#f3b28a';
export const APRICOT = '#df7a5c';
/** Flat background of the Android adaptive icon (mid-point of the gradient). */
export const ADAPTIVE_BACKGROUND = '#e9936f';

/** lucide `droplet` path (24×24 viewBox). */
const DROPLET =
  'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z';

/** Droplet (384px tall box at 1:1) with the sprout subtracted; `s` scales it around the centre. */
function glyphMask(id, s) {
  return `<mask id="${id}">
  <rect width="512" height="512" fill="#000"/>
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)">
    <g transform="translate(64 64) scale(16)"><path d="${DROPLET}" fill="#fff"/></g>
    <g fill="#000" stroke="#000" stroke-width="2" stroke-linejoin="round">
      <path d="M256 372v-86" stroke-width="14" stroke-linecap="round" fill="none"/>
      <path d="M256 318c-44 2-70-22-72-58 40-2 70 20 72 58z"/>
      <path d="M256 296c40 0 66-24 66-58-38-2-66 20-66 58z"/>
    </g>
  </g>
</mask>`;
}

const gradient = (id) =>
  `<linearGradient id="${id}" x1="0.21" y1="0.09" x2="0.79" y2="0.91">
  <stop offset="0" stop-color="${APRICOT_LIGHT}"/><stop offset="1" stop-color="${APRICOT}"/>
</linearGradient>`;

/**
 * Full icon as an `<svg>` element string.
 * @param {{ id: string; shape: 'rounded' | 'square' | 'circle'; glyphScale: number }} opts
 *   `square` = full-bleed (maskable / apple-touch, the OS applies its own mask).
 */
export function iconSvg({ id, shape, glyphScale }) {
  const bg =
    shape === 'circle'
      ? `<circle cx="256" cy="256" r="256" fill="url(#g${id})"/>`
      : `<rect width="512" height="512" rx="${shape === 'rounded' ? 112 : 0}" fill="url(#g${id})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>${gradient(`g${id}`)}${glyphMask(`m${id}`, glyphScale)}</defs>
${bg}
<rect width="512" height="512" fill="#fff" mask="url(#m${id})"/>
</svg>`;
}

/** Adaptive-icon foreground: transparent canvas, the glyph's cut-out shows the background layer. */
export function foregroundSvg(glyphScale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>${glyphMask('mf', glyphScale)}</defs>
<rect width="512" height="512" fill="#fff" mask="url(#mf)"/>
</svg>`;
}

/** The icon's inner contents (no `<svg>` wrapper) for embedding in another drawing. */
export function iconInner({ id, shape, glyphScale }) {
  return iconSvg({ id, shape, glyphScale })
    .replace(/^<svg[^>]*>\n/, '')
    .replace(/\n<\/svg>$/, '');
}
