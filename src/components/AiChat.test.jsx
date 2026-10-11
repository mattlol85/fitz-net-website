import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AiChat from './AiChat';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAuth } from '../contexts/AuthContext';
import { fetchNodes, streamChatWithNode } from '../services/nodeService';

vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: vi.fn(),
}));

vi.mock('../services/nodeService', () => ({
  fetchNodes: vi.fn(),
  streamChatWithNode: vi.fn(),
}));

describe('AiChat Component', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ token: null, isAuthenticated: () => false });
    fetchNodes.mockReset();
  });

  it('renders the preview badge and an initial assistant greeting', () => {
    render(<AiChat />);
    expect(screen.getByText(/not yet connected to a live model/i)).toBeInTheDocument();
    expect(screen.getByText(/i'm matt-gpt/i)).toBeInTheDocument();
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

describe('AiChat streaming, models and links', () => {
  const signedIn = () => {
    useAuth.mockReturnValue({ token: 'jwt', isAuthenticated: () => true });
  };

  it('keeps sending disabled until the reply has finished streaming', async () => {
    render(<AiChat />);
    const input = screen.getByLabelText(/message/i);
    fireEvent.change(input, { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    fireEvent.change(input, { target: { value: 'next' } });
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    await waitFor(() => expect(screen.getByRole('button', { name: /send/i })).toBeEnabled(), { timeout: 5000 });
  });

  it('opens links from a message in a new tab', async () => {
    render(<AiChat />);
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: '[docs](https://example.com)' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    const link = await screen.findByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('lets the user pick a different model on the chosen node', async () => {
    signedIn();
    fetchNodes.mockResolvedValue([
      { id: 'n1', name: 'node-one', status: 'ONLINE', models: ['m1', 'm2'] },
    ]);
    render(<AiChat />);
    fireEvent.change(await screen.findByLabelText('Node'), { target: { value: 'n1' } });

    const model = screen.getByLabelText('Model');
    expect(model).toHaveValue('m1');
    fireEvent.change(model, { target: { value: 'm2' } });

    expect(screen.getByLabelText('Model')).toHaveValue('m2');
    expect(screen.getByText('Connected to node-one (m2)')).toBeInTheDocument();
  });

  it('scrolls the conversation to the newest message when the browser supports it', async () => {
    const original = Element.prototype.scrollTo;
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo;
    try {
      render(<AiChat />);
      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: expect.any(Number), behavior: 'smooth' }));
    } finally {
      Element.prototype.scrollTo = original;
    }
  });

  it('cancels a pending reply when the chat is closed', () => {
    render(<AiChat />);
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'bye' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(() => cleanup()).not.toThrow();
  });
});

describe('AiChat with a selected node and in-flight replies', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ token: 'jwt', isAuthenticated: () => true });
    fetchNodes.mockReset();
    streamChatWithNode.mockReset();
  });

  it('streams the reply from the selected node', async () => {
    fetchNodes.mockResolvedValue([{ id: 'n1', name: 'node-one', status: 'ONLINE', models: ['m1'] }]);
    streamChatWithNode.mockResolvedValueOnce('node says hi');
    render(<AiChat />);

    fireEvent.change(await screen.findByLabelText('Node'), { target: { value: 'n1' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'ping' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText('node says hi')).toBeInTheDocument();
    expect(streamChatWithNode).toHaveBeenCalledWith('n1', 'ping', 'm1', 'jwt', expect.any(Object));
  });

  it('shows an empty bubble, not a placeholder, when the node answers with nothing', async () => {
    fetchNodes.mockResolvedValue([{ id: 'n1', name: 'node-one', status: 'ONLINE', models: ['m1'] }]);
    streamChatWithNode.mockResolvedValueOnce('');
    const { container } = render(<AiChat />);

    fireEvent.change(await screen.findByLabelText('Node'), { target: { value: 'n1' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'ping' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /send/i })).toBeDisabled());
    await waitFor(() => expect(container.querySelectorAll('.ai-chat__message--assistant')).toHaveLength(2));
    expect(screen.queryByText('\u2026')).not.toBeInTheDocument();
  });

  it('shows an empty model list for a node that reports no models', async () => {
    fetchNodes.mockResolvedValue([{ id: 'n2', name: 'bare-node', status: 'ONLINE' }]);
    render(<AiChat />);

    fireEvent.change(await screen.findByLabelText('Node'), { target: { value: 'n2' } });

    expect(screen.getByLabelText('Model').children).toHaveLength(0);
  });

  it('ignores a second submit while the previous reply is still arriving', () => {
    fetchNodes.mockResolvedValue([]);
    const { container } = render(<AiChat />);
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'first' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'second' } });
    fireEvent.submit(container.querySelector('form'));

    expect(container.querySelectorAll('.ai-chat__message--user')).toHaveLength(1);
  });

  it('shows an ellipsis while a preview reply is still being composed', () => {
    fetchNodes.mockResolvedValue([]);
    render(<AiChat />);
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText('\u2026')).toBeInTheDocument();
  });
});
