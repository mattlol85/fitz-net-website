import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { resolveThemeColor, watchThemeChange } from './themeColors';

describe('resolveThemeColor', () => {
  it('should return the fallback when there is no document', () => {
    vi.stubGlobal('document', undefined);
    try {
      expect(resolveThemeColor('--anything', 0x112233)).toBe(0x112233);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--test-color');
    vi.restoreAllMocks();
  });

  it('should return the fallback when the variable is unset', () => {
    expect(resolveThemeColor('--missing-color', 0x123456)).toBe(0x123456);
  });

  it('should default the fallback to white', () => {
    expect(resolveThemeColor('--missing-color')).toBe(0xffffff);
  });

  it('should convert a resolved CSS colour into a hex number', () => {
    document.documentElement.style.setProperty('--test-color', '#ff0000');

    expect(resolveThemeColor('--test-color')).toBe(0xff0000);
  });

  it('should fall back when the colour cannot be parsed by three.js', () => {
    document.documentElement.style.setProperty('--test-color', '#00ff00');
    vi.spyOn(THREE.Color.prototype, 'setStyle').mockImplementation(() => {
      throw new Error('bad colour');
    });

    expect(resolveThemeColor('--test-color', 0xabcdef)).toBe(0xabcdef);
  });
});

describe('watchThemeChange', () => {
  it('should call onChange when the data-theme attribute changes', async () => {
    const onChange = vi.fn();
    const stop = watchThemeChange(onChange);

    document.documentElement.setAttribute('data-theme', 'dark');
    await new Promise((r) => setTimeout(r, 0));

    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    document.documentElement.removeAttribute('data-theme');
  });

  it('should ignore changes to other attributes', async () => {
    const onChange = vi.fn();
    const stop = watchThemeChange(onChange);

    document.documentElement.setAttribute('lang', 'en');
    await new Promise((r) => setTimeout(r, 0));

    expect(onChange).not.toHaveBeenCalled();
    stop();
    document.documentElement.removeAttribute('lang');
  });

  it('should stop observing after the cleanup function runs', async () => {
    const onChange = vi.fn();
    const stop = watchThemeChange(onChange);
    stop();

    document.documentElement.setAttribute('data-theme', 'light');
    await new Promise((r) => setTimeout(r, 0));

    expect(onChange).not.toHaveBeenCalled();
    document.documentElement.removeAttribute('data-theme');
  });

  it('should return a no-op cleanup when there is no document (server render)', () => {
    vi.stubGlobal('document', undefined);
    try {
      const onChange = vi.fn();
      const stop = watchThemeChange(onChange);

      expect(typeof stop).toBe('function');
      expect(() => stop()).not.toThrow();
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('should return a no-op cleanup when MutationObserver is unavailable', () => {
    vi.stubGlobal('MutationObserver', undefined);
    const stop = watchThemeChange(vi.fn());

    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
