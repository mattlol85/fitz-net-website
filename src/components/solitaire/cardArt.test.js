import { describe, expect, it } from 'vitest';
import { CARD_BACKS, cardBackUrl, cardFaceUrl, suitShape } from './cardArt.js';

const decode = (url) => decodeURIComponent(url.replace('data:image/svg+xml;charset=utf-8,', ''));

describe('cardFaceUrl', () => {
  it('should draw every face as an SVG data URL in both layouts', () => {
    for (const suit of ['c', 'd', 'h', 's']) {
      for (let rank = 1; rank <= 13; rank += 1) {
        for (const variant of ['classic', 'compact']) {
          const svg = decode(cardFaceUrl({ suit, rank }, variant));
          expect(svg.startsWith('<svg')).toBe(true);
          expect(svg).toContain('viewBox="0 0 71 96"');
        }
      }
    }
  });

  it('should colour hearts and diamonds red and the rest black', () => {
    expect(decode(cardFaceUrl({ suit: 'h', rank: 5 }))).toContain('#d4001a');
    expect(decode(cardFaceUrl({ suit: 's', rank: 5 }))).not.toContain('#d4001a');
  });

  it('should share one image between duplicate cards', () => {
    expect(cardFaceUrl({ id: 's4-0', suit: 's', rank: 4 })).toBe(cardFaceUrl({ id: 's4-7', suit: 's', rank: 4 }));
  });
});

describe('cardBackUrl', () => {
  it('should draw every back and fall back to the first for an unknown id', () => {
    CARD_BACKS.forEach((back) => expect(decode(cardBackUrl(back.id))).toContain(back.bg));
    expect(cardBackUrl('nope')).toBe(cardBackUrl(CARD_BACKS[0].id));
  });
});

describe('suitShape', () => {
  it('should rotate a shape when flipped', () => {
    expect(suitShape('s', 10, 10, 10, true)).toContain('rotate(180 10 10)');
    expect(suitShape('s', 10, 10, 10)).not.toContain('rotate');
  });
});
