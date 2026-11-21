import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeBox from './RecipeBox';
import { renderBox, resetStore, stubObjectUrls } from './recipeTestUtils';

vi.mock('../../contexts/AuthContext', async () => (await import('./recipeTestUtils')).authModule('lori'));
vi.mock('../../services/recipesApi', async () => (await import('./recipeTestUtils')).recipesApiModule());

describe('RecipeBox', () => {
  beforeEach(async () => {
    await resetStore();
    stubObjectUrls();
  });

  it('should open the recipe box with the book title and a card per recipe', async () => {
    renderBox(<RecipeBox />);
    expect(await screen.findByRole('heading', { level: 1, name: "Lori's Recipe Book" })).toBeInTheDocument();
    expect(await screen.findByText('Sunday Buttermilk Pancakes')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add recipe/ })).toHaveAttribute('href', '/recipes/new');
  });

  it('should open a recipe from its card', async () => {
    renderBox(<RecipeBox />);
    await userEvent.click(await screen.findByRole('link', { name: 'Sunday Buttermilk Pancakes' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sunday Buttermilk Pancakes' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/recipes\/rec-/);
  });

  it('should add a recipe and show it in the box and its detail page', async () => {
    renderBox(<RecipeBox />);
    await userEvent.click(await screen.findByRole('link', { name: /Add recipe/ }));
    await userEvent.type(await screen.findByLabelText('Recipe name'), 'Cinnamon Toast');
    await userEvent.type(screen.getByLabelText('Ingredient 1 name'), 'bread');
    await userEvent.type(screen.getByLabelText('Step 1'), 'Toast it.');
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Cinnamon Toast' })).toBeInTheDocument();
    expect(screen.getByText('Saved!')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: /Recipe box/ }));
    expect(await screen.findByRole('link', { name: 'Cinnamon Toast' })).toBeInTheDocument();
    expect(screen.getByText('9 recipes · 7 chapters')).toBeInTheDocument();
  });

  it('should rename the book from settings and show the new title', async () => {
    renderBox(<RecipeBox />, '/recipes/settings');
    const name = await screen.findByLabelText('Book name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Our Kitchen');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Our Kitchen' })).toBeInTheDocument();
  });

  it('should explain a page that is not in the box', async () => {
    renderBox(<RecipeBox />, '/recipes/a/b/c');
    expect(await screen.findByRole('heading', { name: /isn't in the box/ })).toBeInTheDocument();
    expect(within(document.body).getByRole('link', { name: 'Back to the recipe box' })).toHaveAttribute('href', '/recipes');
  });

  it('should say so when a recipe cannot be found', async () => {
    renderBox(<RecipeBox />, '/recipes/nope');
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument());
  });
});
