import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import LiveCursor from './LiveCursor';

describe('LiveCursor', () => {
  test('renders the username label', () => {
    render(<LiveCursor username="alice" xRatio={0.5} yRatio={0.5} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  test('positions cursor using left/top percentages from xRatio and yRatio', () => {
    render(<LiveCursor username="bob" xRatio={0.3} yRatio={0.7} />);
    const cursor = screen.getByTestId('live-cursor');
    expect(cursor.style.left).toBe('30%');
    expect(cursor.style.top).toBe('70%');
  });

  test('positions at 0% when ratios are 0', () => {
    render(<LiveCursor username="edge" xRatio={0} yRatio={0} />);
    const cursor = screen.getByTestId('live-cursor');
    expect(cursor.style.left).toBe('0%');
    expect(cursor.style.top).toBe('0%');
  });

  test('positions at 100% when ratios are 1', () => {
    render(<LiveCursor username="far" xRatio={1} yRatio={1} />);
    const cursor = screen.getByTestId('live-cursor');
    expect(cursor.style.left).toBe('100%');
    expect(cursor.style.top).toBe('100%');
  });

  test('is not interactive (pointerEvents none)', () => {
    render(<LiveCursor username="ghost" xRatio={0.5} yRatio={0.5} />);
    const cursor = screen.getByTestId('live-cursor');
    expect(cursor.style.pointerEvents).toBe('none');
  });
});

