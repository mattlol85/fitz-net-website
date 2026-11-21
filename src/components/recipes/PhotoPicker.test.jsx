import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PhotoPicker from './PhotoPicker';
import { resetStore, stubObjectUrls } from './recipeTestUtils';

vi.mock('../../contexts/AuthContext', async () => (await import('./recipeTestUtils')).authModule('lori'));
vi.mock('../../services/recipesApi', async () => (await import('./recipeTestUtils')).recipesApiModule());

const jpeg = () => new File(['x'], 'cake.jpg', { type: 'image/jpeg' });

describe('PhotoPicker', () => {
  beforeEach(async () => {
    await resetStore();
    stubObjectUrls();
  });

  it('should offer a labelled add button when there is no photo', () => {
    render(<PhotoPicker onPick={() => {}} onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: /Add a photo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('should report a chosen file', async () => {
    const onPick = vi.fn();
    render(<PhotoPicker onPick={onPick} onRemove={() => {}} />);
    await userEvent.upload(screen.getByLabelText('Choose a photo'), jpeg());
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ name: 'cake.jpg' }));
  });

  it('should report a dropped file', () => {
    const onPick = vi.fn();
    const { container } = render(<PhotoPicker onPick={onPick} onRemove={() => {}} />);
    const zone = container.firstChild;
    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'] } });
    expect(zone).toHaveClass('photo-picker--over');
    fireEvent.drop(zone, { dataTransfer: { files: [jpeg()], types: ['Files'] } });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(zone).not.toHaveClass('photo-picker--over');
  });

  it('should preview the photo with Replace and Remove', async () => {
    const onRemove = vi.fn();
    render(<PhotoPicker previewUrl="blob:p" onPick={() => {}} onRemove={onRemove} />);
    expect(screen.getByRole('img', { name: "Your recipe's photo" })).toHaveAttribute('src', 'blob:p');
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('should show an upload error and disable the buttons while uploading', () => {
    const { rerender } = render(<PhotoPicker uploading onPick={() => {}} onRemove={() => {}} />);
    expect(screen.getByRole('button', { name: /Uploading/ })).toBeDisabled();
    rerender(<PhotoPicker error="Too big" onPick={() => {}} onRemove={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Too big');
  });
});
