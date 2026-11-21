import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as doodles from './doodles';

describe('doodles', () => {
  it('should render every icon as a decorative svg', () => {
    const icons = ['WhiskIcon', 'SpoonIcon', 'HeartIcon', 'ClockIcon', 'PeopleIcon', 'CameraIcon', 'ChevronUpIcon', 'ChevronDownIcon', 'ArrowLeftIcon', 'SlidersIcon'];
    icons.forEach((name) => {
      const Doodle = doodles[name];
      const { container, unmount } = render(<Doodle size={20} />);
      const svg = container.querySelector('svg');
      expect(svg, name).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveAttribute('width', '20');
      unmount();
    });
  });

  it('should fill the heart only when asked', () => {
    const { container, rerender } = render(<doodles.HeartIcon />);
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'none');
    rerender(<doodles.HeartIcon filled />);
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  });

  it('should render the illustrations hidden from screen readers', () => {
    [doodles.BowlIllustration, doodles.PlateSearchIllustration, doodles.PlateIllustration].forEach((Illustration) => {
      const { container, unmount } = render(<Illustration className="x" />);
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(container.querySelector('svg')).toHaveClass('x');
      unmount();
    });
  });
});
