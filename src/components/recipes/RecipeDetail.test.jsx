import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeBox from './RecipeBox';
import { renderBox, resetStore, stubObjectUrls, tokenFor } from './recipeTestUtils';

vi.mock('../../contexts/AuthContext', async () => (await import('./recipeTestUtils')).authModule('lori'));
vi.mock('../../services/recipesApi', async () => (await import('./recipeTestUtils')).recipesApiModule());

async function openPancakes() {
  const api = await import('../../services/recipesApi');
  const { items } = await api.listRecipes(tokenFor('lori'), { q: 'Pancakes' });
  renderBox(<RecipeBox />, `/recipes/${items[0].id}`);
  await screen.findByRole('heading', { level: 1, name: 'Sunday Buttermilk Pancakes' });
  return items[0];
}

describe('RecipeDetail', () => {
  beforeEach(async () => {
    await resetStore();
    stubObjectUrls();
  });

  it('should show the title, added date, chapter and facts', async () => {
    await openPancakes();
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText(/Added Feb 8, 2026/)).toBeInTheDocument();
    const facts = screen.getByRole('list', { name: 'Quick facts' });
    expect(facts).toHaveTextContent('Serves 4');
    expect(facts).toHaveTextContent('Prep 10 min');
    expect(facts).toHaveTextContent('Cook 20 min');
    expect(facts).toHaveTextContent('Total 30 min');
  });

  it('should show ingredients as a checklist and the steps as a numbered list', async () => {
    await openPancakes();
    const ingredients = within(screen.getByRole('region', { name: 'Ingredients' }));
    expect(ingredients.getAllByRole('checkbox')).toHaveLength(8);
    expect(ingredients.getByText('all-purpose flour')).toBeInTheDocument();
    const steps = within(screen.getByRole('region', { name: 'Method' })).getAllByRole('listitem');
    expect(steps).toHaveLength(6);
    expect(steps[0]).toHaveTextContent('Whisk the flour');
  });

  it('should tick ingredients off for this visit and count them', async () => {
    await openPancakes();
    expect(screen.getByText('Tick things off as you cook.')).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    await userEvent.click(boxes[0]);
    await userEvent.click(boxes[3]);
    expect(boxes[0]).toBeChecked();
    expect(screen.getByText('2 of 8 ready')).toBeInTheDocument();
    await userEvent.click(boxes[0]);
    expect(screen.getByText('1 of 8 ready')).toBeInTheDocument();
  });

  it('should load the photo with alt text', async () => {
    await openPancakes();
    expect(await screen.findByRole('img', { name: 'Photo of Sunday Buttermilk Pancakes' })).toBeInTheDocument();
  });

  it('should link to the editor', async () => {
    const recipe = await openPancakes();
    expect(screen.getByRole('link', { name: /Edit/ })).toHaveAttribute('href', `/recipes/${recipe.id}/edit`);
  });

  it('should ask before deleting, and keep the recipe when you say no', async () => {
    await openPancakes();
    await userEvent.click(screen.getByRole('button', { name: /Delete/ }));
    const dialog = screen.getByRole('dialog', { name: /Delete “Sunday Buttermilk Pancakes”\?/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Sunday Buttermilk Pancakes' })).toBeInTheDocument();
  });

  it('should delete after confirming and go back to the box', async () => {
    await openPancakes();
    await userEvent.click(screen.getByRole('button', { name: /Delete/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/recipes$/));
    expect(await screen.findByText('7 recipes · 7 chapters')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sunday Buttermilk Pancakes' })).not.toBeInTheDocument();
  });
});
