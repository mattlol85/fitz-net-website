import { describe, expect, it } from 'vitest';
import { chapterStyle, coverStyle, tabHue } from './recipeColors';

describe('recipeColors', () => {
  it('should map the API default chapter colour names to hues', () => {
    ['amber', 'sage', 'rose', 'teal', 'coral', 'plum', 'sky'].forEach((name) => {
      const [h, s] = tabHue(name);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(s).toBeGreaterThan(0);
    });
    expect(tabHue('Amber')).toEqual(tabHue('amber'));
  });

  it('should derive a hue from a hex colour', () => {
    expect(tabHue('#ff0000')[0]).toBe(0);
    expect(tabHue('#00ff00')[0]).toBe(120);
    expect(tabHue('#0000ff')[0]).toBe(240);
    expect(tabHue('#808080')).toEqual([220, 8]);
  });

  it('should fall back to pink for unknown names and malformed hex', () => {
    const fallback = tabHue('');
    expect(tabHue('chartreuse-ish')).toEqual(fallback);
    expect(tabHue('#12345')).toEqual(fallback);
    expect(tabHue(null)).toEqual(fallback);
  });

  it('should expose hue and saturation as CSS custom properties', () => {
    expect(chapterStyle('amber')).toEqual({ '--tint-h': 38, '--tint-s': '85%' });
    expect(coverStyle('navy')['--tint-h']).toBe(220);
    expect(coverStyle('nope')).toEqual(coverStyle('rose'));
  });
});
