import { afterEach, describe, expect, it } from 'vitest';
import { BREAKPOINTS, MEDIA } from '../constants/breakpoints';
import { evaluateQuery, mockMatchMedia } from './mockMatchMedia';

describe('breakpoints', () => {
  it('should put every width on exactly one side of the tablet/desktop edge', () => {
    for (const width of [767, 767.5, 767.98, 768, 768.5]) {
      const tablet = evaluateQuery(MEDIA.tablet, { width });
      const desktop = evaluateQuery(MEDIA.desktop, { width });
      expect(tablet).not.toBe(desktop);
    }
  });

  it('should treat a 768px iPad in portrait as desktop', () => {
    expect(evaluateQuery(MEDIA.desktop, { width: BREAKPOINTS.desktop })).toBe(true);
    expect(evaluateQuery(MEDIA.tablet, { width: BREAKPOINTS.desktop })).toBe(false);
  });

  it('should match phone and small queries on a 375px phone', () => {
    expect(evaluateQuery(MEDIA.phone, { width: 375 })).toBe(true);
    expect(evaluateQuery(MEDIA.small, { width: 375 })).toBe(true);
    expect(evaluateQuery(MEDIA.tablet, { width: 375 })).toBe(true);
  });

  it('should match the touch query only on touch devices', () => {
    expect(evaluateQuery(MEDIA.touch, { touch: true })).toBe(true);
    expect(evaluateQuery(MEDIA.touch, { touch: false })).toBe(false);
  });
});

describe('mockMatchMedia', () => {
  let restore;
  afterEach(() => restore?.());

  it('should install a matchMedia that answers for the given viewport', () => {
    restore = mockMatchMedia({ width: 375, touch: true });
    expect(window.matchMedia(MEDIA.desktop).matches).toBe(false);
    expect(window.matchMedia(MEDIA.touch).matches).toBe(true);
  });

  it('should restore the previous matchMedia', () => {
    const before = window.matchMedia;
    mockMatchMedia({ width: 1280 })();
    expect(window.matchMedia).toBe(before);
  });
});
