import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ContextRing, { contextLevel } from './ContextRing';

describe('ContextRing', () => {
  it('renders nothing without a known window size', () => {
    const { container } = render(<ContextRing used={5} max={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels usage and fills the arc proportionally', () => {
    render(<ContextRing used={2048} max={8192} />);
    const ring = screen.getByTestId('context-ring');
    expect(ring).toHaveAttribute('aria-label', 'Context: 2,048 / 8,192 tokens (25%)');
    expect(ring).toHaveClass('context-ring--ok');
    const circumference = 2 * Math.PI * 9;
    const value = ring.querySelector('.context-ring__value');
    expect(Number(value.getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.75);
  });

  it('clamps overflow to 100%', () => {
    render(<ContextRing used={9000} max={8192} />);
    expect(screen.getByTestId('context-ring')).toHaveTextContent('100%');
  });

  it('maps fractions to levels', () => {
    expect(contextLevel(0.5)).toBe('ok');
    expect(contextLevel(0.7)).toBe('warn');
    expect(contextLevel(0.9)).toBe('danger');
  });
});
