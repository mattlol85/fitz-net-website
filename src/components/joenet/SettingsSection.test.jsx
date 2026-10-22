import React from 'react';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsSection from './SettingsSection.jsx';
import { mockJoenetRoutes, renderWithJoenet } from './joenetTestUtils.jsx';
import * as AuthContext from '../../contexts/AuthContext';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  AuthContext.useAuth.mockReturnValue({ token: 'jwt', loading: false });
});

describe('SettingsSection', () => {
  it('should list quality profiles, root folders and tags', async () => {
    mockJoenetRoutes({
      'GET qualityprofile': [{ id: 1, name: 'HD-1080p' }],
      'GET rootfolder': [{ id: 1, path: '/media/movies' }],
      'GET tag': [{ id: 1, label: 'kids' }],
    });
    renderWithJoenet(<SettingsSection app="radarr" />);

    expect(await screen.findByText('HD-1080p')).toBeInTheDocument();
    expect(screen.getByText('/media/movies')).toBeInTheDocument();
    expect(screen.getByText('kids')).toBeInTheDocument();
  });

  it('should say when nothing is configured', async () => {
    mockJoenetRoutes({ 'GET qualityprofile': [], 'GET rootfolder': [], 'GET tag': [] });
    renderWithJoenet(<SettingsSection app="sonarr" />);

    expect(await screen.findAllByText('None configured.')).toHaveLength(3);
  });
});
