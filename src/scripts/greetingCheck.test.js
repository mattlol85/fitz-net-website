import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The script registers a window "load" listener on import. Capture that
// listener, fire it once, then remove it so it cannot leak into other tests.
const loadGreeting = async () => {
  const addSpy = vi.spyOn(window, 'addEventListener');
  vi.resetModules();
  await import('./greetingCheck.js');
  const [, handler] = addSpy.mock.calls.find(([type]) => type === 'load');
  addSpy.mockRestore();

  window.dispatchEvent(new Event('load'));
  window.removeEventListener('load', handler);
};

describe('greetingCheck', () => {
  const originalAlert = window.alert;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="greeting-message"></div>';
    window.alert = vi.fn();
  });

  afterEach(() => {
    window.alert = originalAlert;
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('should alert and reveal the greeting on the first visit', async () => {
    await loadGreeting();

    expect(window.alert).toHaveBeenCalledWith('Hello, World!');
    expect(document.getElementById('greeting-message').style.display).toBe('block');
    expect(localStorage.getItem('greetingShown')).toBe('true');
  });

  it('should keep the greeting hidden on repeat visits', async () => {
    localStorage.setItem('greetingShown', 'true');
    await loadGreeting();

    expect(window.alert).not.toHaveBeenCalled();
    expect(document.getElementById('greeting-message').style.display).toBe('');
  });

  it('should skip the greeting instead of throwing when storage is blocked', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      await expect(loadGreeting()).resolves.not.toThrow();
      expect(window.alert).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('should not throw when the page has no greeting element', async () => {
    document.body.innerHTML = '';
    await loadGreeting();

    expect(localStorage.getItem('greetingShown')).toBe('true');
  });
});
