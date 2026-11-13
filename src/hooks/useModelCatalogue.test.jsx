import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useModelCatalogue, { CATALOGUE_POLL_MS, CATALOGUE_POLL_OPEN_MS } from './useModelCatalogue';
import { listModels } from '../services/aiChatApi';

vi.mock('../services/aiChatApi', () => ({ listModels: vi.fn() }));

const flush = () => act(async () => {});
const tick = (ms) => act(async () => vi.advanceTimersByTimeAsync(ms));

describe('useModelCatalogue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listModels.mockResolvedValue({ nodes: [], models: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should load the catalogue on mount', async () => {
    const { result } = renderHook(() => useModelCatalogue({ token: 'jwt' }));
    await flush();

    expect(listModels).toHaveBeenCalledWith('jwt', { refresh: false });
    expect(result.current.catalogue).toEqual({ nodes: [], models: [] });
    expect(result.current.loading).toBe(false);
  });

  it('should poll every 60 seconds while the picker is closed', async () => {
    renderHook(() => useModelCatalogue({ token: 'jwt' }));
    await flush();
    listModels.mockClear();

    await tick(CATALOGUE_POLL_OPEN_MS * 2);
    expect(listModels).not.toHaveBeenCalled();

    await tick(CATALOGUE_POLL_MS - CATALOGUE_POLL_OPEN_MS * 2);
    expect(listModels).toHaveBeenCalledTimes(1);
  });

  it('should refetch at once and then poll every 15 seconds while the picker is open', async () => {
    const { rerender } = renderHook(({ fast }) => useModelCatalogue({ token: 'jwt', fast }), {
      initialProps: { fast: false },
    });
    await flush();
    listModels.mockClear();

    rerender({ fast: true });
    await flush();
    expect(listModels).toHaveBeenCalledTimes(1);

    await tick(CATALOGUE_POLL_OPEN_MS * 2);
    expect(listModels).toHaveBeenCalledTimes(3);

    rerender({ fast: false });
    listModels.mockClear();
    await tick(CATALOGUE_POLL_OPEN_MS * 2);
    expect(listModels).not.toHaveBeenCalled();
  });

  it('should keep the last good catalogue and report the error when a poll fails', async () => {
    const { result } = renderHook(() => useModelCatalogue({ token: 'jwt' }));
    await flush();
    listModels.mockRejectedValue(new Error('HTTP 503'));

    await tick(CATALOGUE_POLL_MS);

    expect(result.current.catalogue).toEqual({ nodes: [], models: [] });
    expect(result.current.error).toBe('HTTP 503');
  });

  it('should force a server-side refresh on refresh()', async () => {
    const { result } = renderHook(() => useModelCatalogue({ token: 'jwt' }));
    await flush();

    await act(async () => result.current.refresh());

    expect(listModels).toHaveBeenLastCalledWith('jwt', { refresh: true });
  });

  it('should pause polling while the tab is hidden and reload once when it is shown again', async () => {
    const setHidden = (hidden) => Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    renderHook(() => useModelCatalogue({ token: 'jwt' }));
    await flush();
    listModels.mockClear();

    setHidden(true);
    await tick(CATALOGUE_POLL_MS * 3);
    expect(listModels).not.toHaveBeenCalled();

    setHidden(false);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(listModels).toHaveBeenCalledTimes(1);
    await tick(CATALOGUE_POLL_MS);
    expect(listModels).toHaveBeenCalledTimes(2);
  });

  it('should stop polling on unmount', async () => {
    const { unmount } = renderHook(() => useModelCatalogue({ token: 'jwt' }));
    await flush();
    unmount();
    listModels.mockClear();

    await tick(CATALOGUE_POLL_MS * 2);

    expect(listModels).not.toHaveBeenCalled();
  });
});
