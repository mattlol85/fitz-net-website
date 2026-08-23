import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AiChat from './AiChat';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAuth } from '../contexts/AuthContext';
import { fetchNodes } from '../services/nodeService';

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: vi.fn(),
}));

vi.mock('../services/nodeService', () => ({
  fetchNodes: vi.fn(),
  chatWithNode: vi.fn(),
}));

describe('AiChat Component', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ token: null, isAuthenticated: () => false });
    fetchNodes.mockReset();
  });

  it('renders the preview badge and an initial assistant greeting', () => {
    render(<AiChat />);
    expect(screen.getByText(/not yet connected to a live model/i)).toBeInTheDocument();
    expect(screen.getByText(/preview of the Fitz-Net AI chat/i)).toBeInTheDocument();
  });

  it('sends a message and eventually shows a mock assistant reply', async () => {
    render(<AiChat />);
    const input = screen.getByLabelText(/message/i);

    fireEvent.change(input, { target: { value: 'Hello there' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText('Hello there')).toBeInTheDocument();
    expect(input).toHaveValue('');

    await waitFor(
      () => {
        const messages = screen.getByTestId('ai-chat-messages');
        expect(messages.querySelectorAll('.ai-chat__message--assistant').length).toBeGreaterThan(1);
      },
      { timeout: 3000 }
    );
  });

  it('does not show a node picker when logged out', async () => {
    render(<AiChat />);
    expect(screen.queryByLabelText(/^node$/i)).not.toBeInTheDocument();
  });

  it('shows a node picker with online nodes when logged in', async () => {
    useAuth.mockReturnValue({ token: 'fake-jwt', isAuthenticated: () => true });
    fetchNodes.mockResolvedValueOnce([
      { id: 'n1', name: 'matt-pc', status: 'ONLINE', models: ['qwen3:14b', 'qwen3-coder:30b'] },
      { id: 'n2', name: 'offline-node', status: 'OFFLINE', models: ['qwen3:8b'] },
    ]);

    render(<AiChat />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^node$/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'matt-pc' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'offline-node' })).not.toBeInTheDocument();
  });

  it('switches the badge and model picker when a node is selected', async () => {
    useAuth.mockReturnValue({ token: 'fake-jwt', isAuthenticated: () => true });
    fetchNodes.mockResolvedValueOnce([
      { id: 'n1', name: 'matt-pc', status: 'ONLINE', models: ['qwen3:14b', 'qwen3-coder:30b'] },
    ]);

    render(<AiChat />);

    await waitFor(() => {
      expect(screen.getByLabelText(/^node$/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^node$/i), { target: { value: 'n1' } });

    await waitFor(() => {
      expect(screen.getByText(/connected to matt-pc \(qwen3:14b\)/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/^model$/i)).toBeInTheDocument();
  });
});
