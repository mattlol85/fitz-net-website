/*
 * Card faces and backs, drawn as SVG strings on a 71 x 96 card (the classic desktop proportions)
 * and served as data URLs for the <img> cards on the board, and because they're vectors they stay sharp at any card size.
 *
 * Two face layouts: 'classic' with small corner indices and full pip layouts, and 'compact' with
 * a big rank and suit along the top edge, for small cards on phones where only a strip of each
 * fanned card shows. Images are cached per face, so Spider's duplicate cards share one.
 */
import { RANK_LABELS, isRed } from './spider.js';

export const CARD_W = 71;
export const CARD_H = 96;
const RED = '#d4001a';
const BLACK = '#111111';
const FONT = "Arial, Helvetica, 'Liberation Sans', sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

// Suit outlines in a 100 x 100 box, centred on (50, 50).
const SUIT_PATHS = {
  h: '<path d="M50 92C42 82 4 58 4 32 4 15 16 5 29 5c10 0 17 6 21 14 4-8 11-14 21-14 13 0 25 10 25 27 0 26-38 50-46 60z"/>',
  d: '<path d="M50 3 88 50 50 97 12 50z"/>',
  s: '<path d="M50 4C38 22 6 40 6 62c0 14 10 22 22 22 9 0 15-4 19-10-1 10-6 18-14 24h34c-8-6-13-14-14-24 4 6 10 10 19 10 12 0 22-8 22-22C94 40 62 22 50 4z"/>',
  c: '<circle cx="50" cy="27" r="21"/><circle cx="25" cy="57" r="21"/><circle cx="75" cy="57" r="21"/>'
    + '<rect x="40" y="35" width="20" height="25"/><path d="M47 55c-1 18-6 30-14 41h34c-8-11-13-23-14-41z"/>',
};

const n = (v) => Math.round(v * 100) / 100;

/** A suit symbol of width `size` centred on (cx, cy), optionally upside down. */
export function suitShape(suit, cx, cy, size, flip = false) {
  const s = size / 100;
  const rot = flip ? ` rotate(180 ${n(cx)} ${n(cy)})` : '';
  return `<g transform="${rot.trim()} translate(${n(cx - size / 2)} ${n(cy - size / 2)}) scale(${n(s)})">${SUIT_PATHS[suit]}</g>`;
}

const L = 21.5;
const C = 35.5;
const R = 49.5;
const T = 17;
const B = 79;
const M = 48;
const R1 = T + (B - T) / 3;
const R2 = T + (2 * (B - T)) / 3;

// Pip centres for 2-10.
const PIPS = {
  2: [[C, T], [C, B]],
  3: [[C, T], [C, M], [C, B]],
  4: [[L, T], [R, T], [L, B], [R, B]],
  5: [[L, T], [R, T], [C, M], [L, B], [R, B]],
  6: [[L, T], [R, T], [L, M], [R, M], [L, B], [R, B]],
  7: [[L, T], [R, T], [C, (T + M) / 2], [L, M], [R, M], [L, B], [R, B]],
  8: [[L, T], [R, T], [C, (T + M) / 2], [L, M], [R, M], [C, (M + B) / 2], [L, B], [R, B]],
  9: [[L, T], [R, T], [L, R1], [R, R1], [C, M], [L, R2], [R, R2], [L, B], [R, B]],
  10: [[L, T], [R, T], [C, (T + R1) / 2], [L, R1], [R, R1], [L, R2], [R, R2], [C, (R2 + B) / 2], [L, B], [R, B]],
};

const EMBLEMS = {
  // King: a crown.
  13: (cx, cy) => `<path d="M${cx - 9} ${cy + 5}l-1-10 5 4 5-7 5 7 5-4-1 10z" fill="#f2c230" stroke="#7a5b00" stroke-width=".7" stroke-linejoin="round"/>`
    + `<circle cx="${cx}" cy="${cy - 7.5}" r="1.3" fill="#d4001a"/>`,
  // Queen: a tiara.
  12: (cx, cy) => `<path d="M${cx - 9} ${cy + 4}q9-12 18 0z" fill="#f2c230" stroke="#7a5b00" stroke-width=".7"/>`
    + `<circle cx="${cx}" cy="${cy - 3}" r="1.6" fill="#2b6cd4"/><circle cx="${cx - 5}" cy="${cy}" r="1" fill="#d4001a"/>`
    + `<circle cx="${cx + 5}" cy="${cy}" r="1" fill="#d4001a"/>`,
  // Jack: a plumed cap.
  11: (cx, cy) => `<path d="M${cx - 8} ${cy + 4}q8-10 16 0z" fill="#2b6cd4" stroke="#123a7a" stroke-width=".7"/>`
    + `<path d="M${cx + 4} ${cy - 1}q6-7 8-1q-4-1-8 1z" fill="#f2c230" stroke="#7a5b00" stroke-width=".5"/>`,
};

function rankText(label, x, y, size, color, anchor = 'middle') {
  const squeeze = label === '10' ? ` textLength="${n(size * 1.05)}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text x="${n(x)}" y="${n(y)}" font-family="${FONT}" font-weight="700" font-size="${size}" fill="${color}" text-anchor="${anchor}"${squeeze}>${label}</text>`;
}

function shell(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W * 2}" height="${CARD_H * 2}">`
    + `<rect x=".5" y=".5" width="70" height="95" rx="4" fill="#fff" stroke="#000" stroke-width="1"/>${inner}</svg>`;
}

function faceFigure(card, color, cx, top, bottom) {
  // Half of a double-headed court card: emblem, flanked letter. The caller mirrors it.
  const mid = (top + bottom) / 2;
  return EMBLEMS[card.rank](cx, top + 10)
    + `<text x="${cx}" y="${n(mid + 9)}" font-family="${SERIF}" font-weight="700" font-size="17" fill="${color}" text-anchor="middle">${RANK_LABELS[card.rank]}</text>`
    + `<g fill="${color}">${suitShape(card.suit, cx - 13, mid + 3, 8)}${suitShape(card.suit, cx + 13, mid + 3, 8)}</g>`;
}

function classicFace(card) {
  const color = isRed(card) ? RED : BLACK;
  const label = RANK_LABELS[card.rank];
  const index = `${rankText(label, 7.5, 13, 12, color)}<g fill="${color}">${suitShape(card.suit, 7.5, 20.5, 8)}</g>`;
  let body;
  if (card.rank === 1) {
    const size = card.suit === 's' ? 40 : 30;
    body = `<g fill="${color}">${suitShape(card.suit, C, M, size)}</g>`;
  } else if (card.rank <= 10) {
    body = `<g fill="${color}">${PIPS[card.rank].map(([x, y]) => suitShape(card.suit, x, y, 13, y > M)).join('')}</g>`;
  } else {
    const half = faceFigure(card, color, C, 9, M);
    body = `<rect x="13" y="9" width="45" height="78" rx="1.5" fill="#fff6e0" stroke="${color}" stroke-width="1"/>`
      + `<rect x="15" y="11" width="41" height="74" fill="none" stroke="${color}" stroke-width=".4"/>`
      + `<line x1="15" y1="${M}" x2="56" y2="${M}" stroke="${color}" stroke-width=".4"/>`
      + half + `<g transform="rotate(180 ${C} ${M})">${half}</g>`;
  }
  return shell(index + body + `<g transform="rotate(180 ${C} ${M})">${index}</g>`);
}

function compactFace(card) {
  const color = isRed(card) ? RED : BLACK;
  const label = RANK_LABELS[card.rank];
  const index = rankText(label, 4, 25, 26, color, 'start')
    + `<g fill="${color}">${suitShape(card.suit, 57, 15, 20)}</g>`;
  let body;
  if (card.rank >= 11) {
    body = `<rect x="11" y="33" width="49" height="56" rx="3" fill="#fff6e0" stroke="${color}" stroke-width="1"/>`
      + EMBLEMS[card.rank](C, 44)
      + `<g fill="${color}">${suitShape(card.suit, C, 70, 26)}</g>`;
  } else {
    body = `<g fill="${color}">${suitShape(card.suit, C, 62, card.rank === 1 ? 40 : 34)}</g>`;
  }
  return shell(index + body);
}

// Backs: a white margin around a patterned panel. All original designs.
export const CARD_BACKS = [
  {
    id: 'lori',
    label: 'Lori hearts',
    bg: '#e6007e',
    pattern: '<pattern id="p" width="12" height="12" patternUnits="userSpaceOnUse">'
      + `<g fill="#ffb3d9" opacity=".9">${suitShape('h', 3.5, 3.5, 5)}${suitShape('h', 9.5, 9.5, 5)}</g></pattern>`,
  },
  {
    id: 'lattice',
    label: 'Blue lattice',
    bg: '#1f3f9e',
    pattern: '<pattern id="p" width="6" height="6" patternUnits="userSpaceOnUse">'
      + '<path d="M0 0l6 6M6 0 0 6" stroke="#8fb2ff" stroke-width=".7"/></pattern>',
  },
  {
    id: 'crimson',
    label: 'Red lattice',
    bg: '#a3121e',
    pattern: '<pattern id="p" width="6" height="6" patternUnits="userSpaceOnUse">'
      + '<path d="M0 0l6 6M6 0 0 6" stroke="#ff9a9a" stroke-width=".7"/><circle cx="3" cy="3" r=".8" fill="#ffd1d1"/></pattern>',
  },
  {
    id: 'waves',
    label: 'Ocean waves',
    bg: '#0b6e7f',
    pattern: '<pattern id="p" width="14" height="8" patternUnits="userSpaceOnUse">'
      + '<path d="M0 6q3.5-5 7 0t7 0" fill="none" stroke="#9ff0f5" stroke-width="1"/></pattern>',
  },
  {
    id: 'meadow',
    label: 'Meadow checks',
    bg: '#2f7d32',
    pattern: '<pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse">'
      + '<rect width="4" height="4" fill="#58b85c"/><rect x="4" y="4" width="4" height="4" fill="#58b85c"/></pattern>',
  },
  {
    id: 'night',
    label: 'Starry night',
    bg: '#241a5c',
    pattern: '<pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse">'
      + '<circle cx="3" cy="4" r=".9" fill="#fff6c2"/><circle cx="11" cy="9" r=".6" fill="#fff"/>'
      + '<circle cx="6" cy="13" r=".5" fill="#c9c2ff"/><path d="M13 2l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="#ffe680"/></pattern>',
  },
  {
    id: 'argyle',
    label: 'Golden argyle',
    bg: '#7a4b12',
    pattern: '<pattern id="p" width="10" height="14" patternUnits="userSpaceOnUse">'
      + '<path d="M5 0l5 7-5 7-5-7z" fill="#c98a2b"/><path d="M0 0l10 14M10 0 0 14" stroke="#ffe3a3" stroke-width=".4"/></pattern>',
  },
  {
    id: 'polka',
    label: 'Lilac polka',
    bg: '#7c4dbd',
    pattern: '<pattern id="p" width="9" height="9" patternUnits="userSpaceOnUse">'
      + '<circle cx="2.25" cy="2.25" r="1.5" fill="#e3d4ff"/><circle cx="6.75" cy="6.75" r="1.5" fill="#e3d4ff"/></pattern>',
  },
];

function backSvg(back) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W * 2}" height="${CARD_H * 2}">`
    + `<defs>${back.pattern}</defs>`
    + '<rect x=".5" y=".5" width="70" height="95" rx="4" fill="#fff" stroke="#000" stroke-width="1"/>'
    + `<rect x="4" y="4" width="63" height="88" rx="2" fill="${back.bg}"/>`
    + '<rect x="4" y="4" width="63" height="88" rx="2" fill="url(#p)"/>'
    + '<rect x="6.5" y="6.5" width="58" height="83" rx="1.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8"/>'
    + '</svg>';
}

const toDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const cache = new Map();

export function cardFaceUrl(card, variant = 'classic') {
  const key = `${variant}:${card.suit}${card.rank}`;
  if (!cache.has(key)) cache.set(key, toDataUrl(variant === 'compact' ? compactFace(card) : classicFace(card)));
  return cache.get(key);
}

export function cardBackUrl(backId) {
  const back = CARD_BACKS.find((b) => b.id === backId) || CARD_BACKS[0];
  const key = `back:${back.id}`;
  if (!cache.has(key)) cache.set(key, toDataUrl(backSvg(back)));
  return cache.get(key);
}
