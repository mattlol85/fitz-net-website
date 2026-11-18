import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import useVisualViewport, { keyboardInset } from './useVisualViewport';

function fakeViewport({ height, offsetTop = 0 }) {
  const listeners = {};
  return {
    height,
    offsetTop,
    addEventListener: (type, fn) => {
      listeners[type] = fn;
    },
    removeEventListener: (type) => {
      delete listeners[type];
    },
    fire(type) {
      listeners[type]?.();
    },
    listeners,
  };
}

describe('keyboardInset', () => {
  it('should be 0 when visualViewport is unsupported', () => {
    expect(keyboardInset({ innerHeight: 800 })).toBe(0);
  });

  it('should report the height the keyboard covers', () => {
    const win = { innerHeight: 800, visualViewport: { height: 460, offsetTop: 0 } };
    expect(keyboardInset(win)).toBe(340);
  });

  it('should ignore small differences from toolbars or zoom', () => {
    const win = { innerHeight: 800, visualViewport: { height: 760, offsetTop: 0 } };
    expect(keyboardInset(win)).toBe(0);
  });

  it('should subtract the visual viewport scroll offset', () => {
    const win = { innerHeight: 800, visualViewport: { height: 400, offsetTop: 100 } };
    expect(keyboardInset(win)).toBe(300);
  });
});

describe('useVisualViewport', () => {
  const original = window.visualViewport;
  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: original, configurable: true });
  });

  it('should publish --keyboard-inset and update it on resize', () => {
    const vv = fakeViewport({ height: window.innerHeight });
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });

    const { unmount } = renderHook(() => useVisualViewport());
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--keyboard-inset')).toBe('0px');

    vv.height = window.innerHeight - 300;
    vv.fire('resize');
    expect(root.style.getPropertyValue('--keyboard-inset')).toBe('300px');

    unmount();
    expect(root.style.getPropertyValue('--keyboard-inset')).toBe('');
    expect(vv.listeners.resize).toBeUndefined();
  });

  it('should do nothing when visualViewport is unsupported', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
    expect(() => renderHook(() => useVisualViewport()).unmount()).not.toThrow();
  });
});
