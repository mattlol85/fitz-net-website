import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AiChat from './AiChat';
import { describe, expect, it } from 'vitest';

describe('AiChat Component', () => {
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
});
