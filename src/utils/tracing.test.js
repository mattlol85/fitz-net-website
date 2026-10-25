import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CORRELATION_ID_HEADER,
  installFetchTracing,
  newCorrelationId,
  withCorrelationId,
} from './tracing';

describe('tracing', () => {
  let originalFetch;
  let fetchSpy;

  beforeEach(() => {
    originalFetch = window.fetch;
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    window.fetch = fetchSpy;
    installFetchTracing();
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  it('should generate ids the backends accept', () => {
    expect(newCorrelationId()).toMatch(/^web-[A-Za-z0-9]{8}$/);
  });

  it('should add a correlation id to same-origin and relative requests', async () => {
    await window.fetch('/api/info', { headers: { Accept: 'application/json' } });

    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers.get(CORRELATION_ID_HEADER)).toMatch(/^web-/);
    expect(headers.get('Accept')).toBe('application/json');
  });

  it('should keep a correlation id the caller already set', async () => {
    await window.fetch('/api/info', { headers: { [CORRELATION_ID_HEADER]: 'mine-1' } });

    expect(fetchSpy.mock.calls[0][1].headers.get(CORRELATION_ID_HEADER)).toBe('mine-1');
  });

  it('should leave foreign origins untouched', async () => {
    await window.fetch('https://example.com/data', { headers: { Accept: 'text/plain' } });

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/data', {
      headers: { Accept: 'text/plain' },
    });
  });

  it('should append the correlation id to websocket urls', () => {
    expect(withCorrelationId('ws://localhost:8080/ws', 'web-1')).toBe(
      'ws://localhost:8080/ws?correlationId=web-1'
    );
    expect(withCorrelationId('ws://h/ws?x=1', 'web-1')).toBe('ws://h/ws?x=1&correlationId=web-1');
  });
});
