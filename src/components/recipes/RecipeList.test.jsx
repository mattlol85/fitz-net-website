import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeBox from './RecipeBox';
import { renderBox, resetStore, stubObjectUrls, tokenFor } from './recipeTestUtils';

vi.mock('../../contexts/AuthContext', async () => (await import('./recipeTestUtils')).authModule('lori'));
vi.mock('../../services/recipesApi', async () => (await import('./recipeTestUtils')).recipesApiModule());

const cards = () => screen.findAllByRole('article');

describe('RecipeList', () => {
  beforeEach(async () => {
    await resetStore();
    stubObjectUrls();
  });

  it('should show every recipe and the count, newest first', async () => {
    renderBox(<RecipeBox />);
    const list = await cards();
    expect(list).toHaveLength(8);
    expect(within(list[0]).getByRole('heading', { level: 3 })).toHaveTextContent('Pink Lemonade');
    expect(await screen.findByText('8 recipes · 7 chapters')).toBeInTheDocument();
  });

  it('should filter by a chapter pill and keep it in the URL', async () => {
    renderBox(<RecipeBox />);
    await cards();
    await userEvent.click(screen.getByRole('button', { name: /^Desserts/ }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.getByRole('link', { name: 'Strawberry Shortcake' })).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toMatch(/\?chapter=/);
    expect(screen.getByRole('button', { name: /^Desserts/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should AND ingredient chips from the URL and highlight the matches', async () => {
    renderBox(<RecipeBox />, '/recipes?ingredient=egg&ingredient=flour');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Remove egg' })).toBeInTheDocument();
    expect(document.querySelectorAll('mark').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText(/3 recipes found/)).toBeInTheDocument();
  });

  it('should add an ingredient chip from the autocomplete', async () => {
    renderBox(<RecipeBox />);
    await cards();
    const box = screen.getByRole('combobox');
    await userEvent.type(box, 'lemon');
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent(/^lemon/);
    await userEvent.click(options[0]);
    await waitFor(() => expect(screen.getByTestId('location').textContent).toMatch(/ingredient=/));
    await waitFor(() => expect(screen.getAllByRole('article').length).toBeLessThan(8));
  });

  it('should search by title text', async () => {
    renderBox(<RecipeBox />, '/recipes?q=banana');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.getByRole('link', { name: "Grandma's Banana Bread" })).toBeInTheDocument();
    expect(screen.getByLabelText('Search by name')).toHaveValue('banana');
  });

  it('should filter to Unsorted on the client', async () => {
    const api = await import('../../services/recipesApi');
    const token = tokenFor('lori');
    const { items } = await api.listRecipes(token);
    const full = await api.getRecipe(token, items[0].id);
    await api.updateRecipe(token, full.id, { ...full, chapterId: null });
    renderBox(<RecipeBox />, '/recipes?chapter=unsorted');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.getByRole('button', { name: /^Unsorted/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('should show a friendly message and a way back when nothing matches', async () => {
    renderBox(<RecipeBox />, '/recipes?ingredient=truffle');
    expect(await screen.findByRole('heading', { name: 'No recipes match' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(8));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/recipes$/);
  });

  it('should invite you to add a first recipe when the box is empty', async () => {
    const api = await import('../../services/recipesApi');
    const token = tokenFor('lori');
    const { items } = await api.listRecipes(token);
    await Promise.all(items.map((r) => api.deleteRecipe(token, r.id)));
    renderBox(<RecipeBox />);
    expect(await screen.findByRole('heading', { name: 'Your recipe box is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add your first recipe/ })).toHaveAttribute('href', '/recipes/new');
    expect(screen.queryByLabelText('Search by name')).not.toBeInTheDocument();
  });
});
