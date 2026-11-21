import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthedObjectUrl from './useAuthedObjectUrl';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'jwt' }),
}));

function Probe({ cacheKey = 'test', fetchBlob, id }) {
  const { url, error } = useAuthedObjectUrl(cacheKey, fetchBlob, id);
  return <span data-testid="probe">{error ? 'error' : url || 'none'}</span>;
}

describe('useAuthedObjectUrl', () => {
  let counter = 0;
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => `blob:${++counter}`);
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.clearAllMocks());

  it('should fetch once with the token and share the URL between components', async () => {
    const fetchBlob = vi.fn().mockResolvedValue(new Blob(['x']));
    render(
      <>
        <Probe fetchBlob={fetchBlob} id="a" />
        <Probe fetchBlob={fetchBlob} id="a" />
      </>
    );

    await waitFor(() => expect(screen.getAllByTestId('probe')[0]).toHaveTextContent(/^blob:/));
    const [first, second] = screen.getAllByTestId('probe');
    expect(first.textContent).toBe(second.textContent);
    expect(fetchBlob).toHaveBeenCalledTimes(1);
    expect(fetchBlob).toHaveBeenCalledWith('jwt', 'a');
  });

  it('should keep features apart by cache key', async () => {
    const fetchBlob = vi.fn().mockResolvedValue(new Blob(['x']));
    render(
      <>
        <Probe cacheKey="one" fetchBlob={fetchBlob} id="same" />
        <Probe cacheKey="two" fetchBlob={fetchBlob} id="same" />
      </>
    );
    await waitFor(() => expect(fetchBlob).toHaveBeenCalledTimes(2));
  });

  it('should revoke the URL when the last user unmounts', async () => {
    const fetchBlob = vi.fn().mockResolvedValue(new Blob(['x']));
    const { unmount } = render(<Probe fetchBlob={fetchBlob} id="b" />);
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent(/^blob:/));
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('should report an error when the fetch fails and do nothing without an id', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('404'));
    render(<Probe fetchBlob={failing} id="c" />);
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('error'));

    const idle = vi.fn();
    render(<Probe cacheKey="idle" fetchBlob={idle} id={null} />);
    expect(idle).not.toHaveBeenCalled();
  });
});
