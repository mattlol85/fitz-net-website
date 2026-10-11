import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import VolumeSlider from './Slider';

describe('VolumeSlider', () => {
  it('should start at zero', () => {
    render(<VolumeSlider />);

    expect(screen.getByRole('slider')).toHaveValue('0');
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should show the new value when the slider changes', () => {
    render(<VolumeSlider />);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '42' } });

    expect(screen.getByRole('slider')).toHaveValue('42');
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
