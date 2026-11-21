import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ChapterPill from './ChapterPill';

describe('ChapterPill', () => {
  it('should render a plain label tinted by the chapter colour', () => {
    const { container } = render(<ChapterPill name="Baking" tabColor="coral" />);
    expect(screen.getByText('Baking')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(container.firstChild.style.getPropertyValue('--tint-h')).toBe('12');
  });

  it('should render a toggle button that reports whether it is selected', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<ChapterPill name="Mains" tabColor="rose" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Mains' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ChapterPill name="Mains" tabColor="rose" onClick={onClick} active />);
    expect(screen.getByRole('button', { name: 'Mains' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should show a count when given one', () => {
    render(<ChapterPill name="Desserts" tabColor="plum" count={3} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Desserts 3' })).toBeInTheDocument();
  });
});
