import { describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';

vi.mock('./App', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', { 'data-testid': 'app-root' }, 'App mounted') };
});

describe('application entry point', () => {
  it('should mount the app inside the #root element in strict mode', async () => {
    const mount = document.createElement('div');
    mount.id = 'root';
    document.body.appendChild(mount);

    await import('./index.jsx');

    // createRoot().render() is asynchronous, so wait for the tree to commit.
    await waitFor(() =>
      expect(mount.querySelector('[data-testid="app-root"]')).toHaveTextContent('App mounted')
    );
    mount.remove();
  });
});
