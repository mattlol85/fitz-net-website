import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from './Card';

describe('Card', () => {
  it('should render the title, description and button text', () => {
    render(<Card title="Title" description="Desc" link="/x" buttonText="Go" />);

    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('should link the button to the provided URL', () => {
    render(<Card title="T" description="D" link="/target" buttonText="Open" />);

    expect(screen.getByRole('button', { name: 'Open' }).closest('a')).toHaveAttribute('href', '/target');
  });
});
