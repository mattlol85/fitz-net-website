import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipePhoto from './RecipePhoto';
import { resetStore, stubObjectUrls, tokenFor } from './recipeTestUtils';

vi.mock('../../contexts/AuthContext', async () => (await import('./recipeTestUtils')).authModule('lori'));
vi.mock('../../services/recipesApi', async () => (await import('./recipeTestUtils')).recipesApiModule());

describe('RecipePhoto', () => {
  beforeEach(async () => {
    await resetStore();
    stubObjectUrls();
  });

  it('should show a plate doodle when the recipe has no photo', () => {
    const { container } = render(<RecipePhoto tabColor="rose" />);
    expect(container.querySelector('.recipe-photo')).toHaveAttribute('data-state', 'empty');
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should show a local preview straight away', () => {
    render(<RecipePhoto previewUrl="blob:preview" alt="Preview" />);
    expect(screen.getByRole('img', { name: 'Preview' })).toHaveAttribute('src', 'blob:preview');
  });

  it('should fetch the server photo through an authed object URL', async () => {
    const { listRecipes } = await import('../../services/recipesApi');
    const { items } = await listRecipes(tokenFor('lori'));
    const withPhoto = items.find((r) => r.imageId);
    const { container } = render(<RecipePhoto imageId={withPhoto.imageId} alt="Dish" />);
    expect(container.querySelector('.recipe-photo')).toHaveAttribute('data-state', 'loading');
    const img = await screen.findByRole('img', { name: 'Dish' });
    await waitFor(() => expect(img).toHaveAttribute('src', expect.stringMatching(/^blob:/)));
  });

  it('should keep the placeholder, not a broken image, when the photo cannot be fetched', async () => {
    const { container } = render(<RecipePhoto imageId="missing" alt="Dish" />);
    await waitFor(() => expect(container.querySelector('.recipe-photo')).toHaveAttribute('data-state', 'empty'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
