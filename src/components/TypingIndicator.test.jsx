import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import TypingIndicator from './TypingIndicator';

describe('TypingIndicator', () => {
  test('should render the username of the person typing', () => {
    render(<TypingIndicator username="alice" xRatio={0.5} yRatio={0.5} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  test('should position itself from the x/y ratios', () => {
    render(<TypingIndicator username="bob" xRatio={0.25} yRatio={0.75} />);
    const el = screen.getByTestId('board-typing');
    expect(el.style.left).toBe('25%');
    expect(el.style.top).toBe('75%');
  });

  test('should render three animated dots', () => {
    render(<TypingIndicator username="cara" xRatio={0.1} yRatio={0.1} />);
    expect(screen.getByTestId('board-typing').querySelectorAll('.board-typing__dots i')).toHaveLength(3);
  });
});
