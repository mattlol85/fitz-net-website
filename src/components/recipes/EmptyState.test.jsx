import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('should show a heading, text and the action, with a hidden illustration', () => {
    const { container } = render(
      <EmptyState title="Your recipe box is empty" text="Add one.">
        <button type="button">Add</button>
      </EmptyState>
    );
    expect(screen.getByRole('heading', { name: 'Your recipe box is empty' })).toBeInTheDocument();
    expect(screen.getByText('Add one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('should pick the search picture for the search variant and skip empty parts', () => {
    const { container } = render(<EmptyState variant="search" title="Nothing" headingLevel={3} />);
    expect(container.firstChild).toHaveAttribute('data-variant', 'search');
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(container.querySelector('.empty-state__text')).toBeNull();
    expect(container.querySelector('.empty-state__actions')).toBeNull();
  });
});
