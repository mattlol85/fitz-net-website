/**
 * Pastel colours for the recipe box. The API stores a chapter's `tabColor` as a lowercase colour
 * name or `#rrggbb` and the book's `coverColor` as one of six names; the UI turns either into a
 * hue and saturation (set as CSS custom properties) so the stylesheets can mix a soft tint in
 * light mode and a deep one in dark mode from the same two numbers.
 */

// name -> [hue, saturation %]
const NAMED = {
  amber: [38, 85],
  sage: [135, 32],
  rose: [345, 78],
  teal: [174, 55],
  coral: [12, 85],
  plum: [292, 42],
  sky: [199, 80],
  lilac: [262, 62],
  red: [2, 75],
  orange: [27, 90],
  yellow: [50, 85],
  green: [128, 45],
  blue: [215, 70],
  purple: [275, 55],
  pink: [330, 80],
  gray: [220, 8],
  grey: [220, 8],
  paper: [330, 18],
};

const FALLBACK = [340, 70];

/** The chapter tab colours the settings page offers (all of them are API defaults or close). */
export const TAB_COLORS = ['amber', 'coral', 'rose', 'plum', 'lilac', 'sky', 'teal', 'sage'];

/** The six cover colours the API accepts, and the banner tint each gives the recipe box. */
export const COVER_COLORS = ['rose', 'burgundy', 'forest', 'navy', 'tan', 'charcoal'];
const COVERS = {
  rose: [338, 80],
  burgundy: [350, 48],
  forest: [140, 38],
  navy: [220, 52],
  tan: [34, 48],
  charcoal: [225, 10],
};

export const COVER_LABELS = {
  rose: 'Rose',
  burgundy: 'Burgundy',
  forest: 'Forest',
  navy: 'Navy',
  tan: 'Tan',
  charcoal: 'Charcoal',
};

function fromHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return [220, 8];
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  return [Math.round((h * 60 + 360) % 360), Math.round(Math.min(Math.max(s, 0.25), 0.9) * 100)];
}

/** `[hue, saturation]` for a tab colour name or hex; anything unknown gets the Lori pink. */
export function tabHue(tabColor) {
  const value = String(tabColor ?? '').trim().toLowerCase();
  if (NAMED[value]) return NAMED[value];
  if (/^#[0-9a-f]{6}$/.test(value)) return fromHex(value);
  return FALLBACK;
}

/** Inline custom properties for any element tinted by a chapter colour. */
export function chapterStyle(tabColor) {
  const [h, s] = tabHue(tabColor);
  return { '--tint-h': h, '--tint-s': `${s}%` };
}

/** Inline custom properties for the banner tinted by the book's cover colour. */
export function coverStyle(coverColor) {
  const [h, s] = COVERS[coverColor] || COVERS.rose;
  return { '--tint-h': h, '--tint-s': `${s}%` };
}
