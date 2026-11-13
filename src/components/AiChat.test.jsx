import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AiChat from './AiChat';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../services/aiChatApi';

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: vi.fn(),
}));

vi.mock('../services/aiChatApi', () => ({
  listModels: vi.fn(),
  getPreferences: vi.fn(),
  listConversations: vi.fn(),
}));

describe('AiChat route entry', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ token: 'jwt' });
    api.listModels.mockResolvedValue({ generatedAt: 'x', nodes: [], models: [] });
    api.getPreferences.mockResolvedValue({ lastTarget: null });
    api.listConversations.mockResolvedValue({ items: [], hasMore: false });
  });

  afterEach(cleanup);

  it('should render the chat page with its sidebar, picker and composer', async () => {
    render(
      <MemoryRouter initialEntries={['/ai']}>
        <AiChat />
      </MemoryRouter>
    );

    expect(await screen.findByRole('complementary', { name: 'Conversations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select a model/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
  });
});
