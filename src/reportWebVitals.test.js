import { describe, expect, it, vi, beforeEach } from 'vitest';

const vitals = vi.hoisted(() => ({
  onCLS: vi.fn(),
  onINP: vi.fn(),
  onFCP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

vi.mock('web-vitals', () => vitals);

import reportWebVitals from './reportWebVitals';

describe('reportWebVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do nothing when no callback is given', async () => {
    reportWebVitals();
    await Promise.resolve();

    expect(vitals.onCLS).not.toHaveBeenCalled();
  });

  it('should do nothing when the callback is not a function', async () => {
    reportWebVitals('not-a-function');
    await Promise.resolve();

    expect(vitals.onCLS).not.toHaveBeenCalled();
  });

  it('should register every core web vital with the callback', async () => {
    const callback = vi.fn();

    reportWebVitals(callback);
    await vi.waitFor(() => expect(vitals.onTTFB).toHaveBeenCalledWith(callback));

    expect(vitals.onCLS).toHaveBeenCalledWith(callback);
    expect(vitals.onINP).toHaveBeenCalledWith(callback);
    expect(vitals.onFCP).toHaveBeenCalledWith(callback);
    expect(vitals.onLCP).toHaveBeenCalledWith(callback);
  });
});
