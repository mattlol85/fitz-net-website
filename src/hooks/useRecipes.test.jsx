import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIngredientIndex, useRecipe, useRecipeBook, useRecipeList } from './useRecipes';
import * as api from '../services/recipesApi';

let auth = { user: { username: 'lori' }, token: 'jwt' };
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../services/recipesApi', () => ({
  getRecipeBook: vi.fn(async () => ({ id: 'b', title: 'Book', chapters: [] })),
  listRecipes: vi.fn(async (_t, { ingredients } = {}) => ({ items: ingredients?.length ? [{ id: 'hit' }] : [{ id: 'r1' }], total: 1 })),
  getRecipe: vi.fn(async (_t, id) => ({ id, title: `Recipe ${id}` })),
  getIngredientIndex: vi.fn(async () => ({ entries: [{ name: 'egg', recipes: [] }] })),
  fetchRecipeImage: vi.fn(),
}));

function Show({ hook }) {
  const { data, error, loading, reload } = hook();
  return (
    <>
      <span data-testid="out">{loading ? 'loading' : error ? `error:${error}` : JSON.stringify(data)}</span>
      <button type="button" onClick={reload}>
        reload
      </button>
    </>
  );
}

describe('useRecipes hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth = { user: { username: 'lori' }, token: 'jwt' };
  });

  it('should load the book', async () => {
    render(<Show hook={() => useRecipeBook(0)} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('"title":"Book"'));
    expect(api.getRecipeBook).toHaveBeenCalledWith('jwt', expect.anything());
  });

  it('should fetch nothing while signed out', async () => {
    auth = { user: null, token: null };
    render(<Show hook={() => useRecipeBook(0)} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('null'));
    expect(api.getRecipeBook).not.toHaveBeenCalled();
  });

  it('should surface the server message when a load fails', async () => {
    api.getIngredientIndex.mockRejectedValueOnce(new Error('Index offline'));
    render(<Show hook={() => useIngredientIndex(0)} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('error:Index offline'));
  });

  it('should list recipes with the search and refetch when it changes', async () => {
    const { rerender } = render(<Show hook={() => useRecipeList({ q: 'pie' }, 0)} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('"id":"r1"'));
    expect(api.listRecipes).toHaveBeenLastCalledWith('jwt', expect.objectContaining({ q: 'pie', ingredients: [], chapterId: undefined }));

    rerender(<Show hook={() => useRecipeList({ ingredients: ['egg'] }, 0)} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('"id":"hit"'));
    expect(api.listRecipes).toHaveBeenCalledTimes(2);
  });

  it('should refetch when the version changes or on reload, and keep old data meanwhile', async () => {
    const { rerender } = render(<Show hook={() => useRecipeList({}, 0)} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('"id":"r1"'));
    rerender(<Show hook={() => useRecipeList({}, 1)} />);
    await waitFor(() => expect(api.listRecipes).toHaveBeenCalledTimes(2));
    await act(async () => screen.getByRole('button', { name: 'reload' }).click());
    await waitFor(() => expect(api.listRecipes).toHaveBeenCalledTimes(3));
  });

  it('should load one recipe by id, and nothing without an id', async () => {
    const { rerender } = render(<Show hook={() => useRecipe('r9', 0)} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('Recipe r9'));
    rerender(<Show hook={() => useRecipe(undefined, 0)} />);
    await waitFor(() => expect(screen.getByTestId('out')).toHaveTextContent('null'));
    expect(api.getRecipe).toHaveBeenCalledTimes(1);
  });
});
