import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeBox from './RecipeBox';
import { renderBox, resetStore, stubObjectUrls, tokenFor } from './recipeTestUtils';

vi.mock('../../contexts/AuthContext', async () => (await import('./recipeTestUtils')).authModule('lori'));
vi.mock('../../services/recipesApi', async () => (await import('./recipeTestUtils')).recipesApiModule());

const openNew = async () => {
  renderBox(<RecipeBox />, '/recipes/new');
  await screen.findByRole('heading', { level: 1, name: 'New recipe' });
};

describe('RecipeForm', () => {
  beforeEach(async () => {
    await resetStore();
    stubObjectUrls();
  });

  it('should show validation problems inline and not save an empty form', async () => {
    await openNew();
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(await screen.findByText('Give the recipe a name.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one ingredient.')).toBeInTheDocument();
    expect(screen.getByText('Write at least one step.')).toBeInTheDocument();
    expect(screen.getByLabelText('Recipe name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('location')).toHaveTextContent('/recipes/new');
    await userEvent.type(screen.getByLabelText('Recipe name'), 'x');
    expect(screen.queryByText('Give the recipe a name.')).not.toBeInTheDocument();
  });

  it('should flag an ingredient with details but no name', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText('Ingredient 1 quantity'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(await screen.findByText('This ingredient needs a name.')).toBeInTheDocument();
    expect(screen.getByLabelText('Ingredient 1 name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should add an ingredient row when Enter is pressed and focus it', async () => {
    await openNew();
    const before = screen.getAllByLabelText(/^Ingredient \d+ name$/).length;
    await userEvent.type(screen.getByLabelText('Ingredient 1 name'), 'flour{Enter}');
    expect(screen.getAllByLabelText(/^Ingredient \d+ name$/)).toHaveLength(before + 1);
    expect(screen.getByLabelText('Ingredient 2 quantity')).toHaveFocus();
  });

  it('should reorder and remove ingredient rows', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText('Ingredient 1 name'), 'salt');
    await userEvent.type(screen.getByLabelText('Ingredient 2 name'), 'pepper');
    await userEvent.click(screen.getByRole('button', { name: 'Move ingredient 1 down' }));
    expect(screen.getByLabelText('Ingredient 1 name')).toHaveValue('pepper');
    expect(screen.getByLabelText('Ingredient 2 name')).toHaveValue('salt');
    expect(screen.getByRole('button', { name: 'Move ingredient 1 up' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));
    expect(screen.getByLabelText('Ingredient 1 name')).toHaveValue('salt');
  });

  it('should add, reorder and remove steps', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText('Step 1'), 'First');
    await userEvent.type(screen.getByLabelText('Step 2'), 'Second');
    await userEvent.click(screen.getByRole('button', { name: 'Add step' }));
    expect(screen.getByLabelText('Step 3')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Move step 2 up' }));
    expect(screen.getByLabelText('Step 1')).toHaveValue('Second');
    await userEvent.click(screen.getByRole('button', { name: 'Remove step 3' }));
    expect(screen.queryByLabelText('Step 3')).not.toBeInTheDocument();
  });

  it('should pick a chapter with the pills', async () => {
    await openNew();
    const pills = within(screen.getByRole('group', { name: 'Chapter' }));
    expect(pills.getByRole('button', { name: 'Unsorted' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(pills.getByRole('button', { name: 'Mains' }));
    expect(pills.getByRole('button', { name: 'Mains' })).toHaveAttribute('aria-pressed', 'true');
    expect(pills.getByRole('button', { name: 'Unsorted' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('should save a full recipe with a photo and open it', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText('Recipe name'), 'Tart');
    await userEvent.click(within(screen.getByRole('group', { name: 'Chapter' })).getByRole('button', { name: 'Desserts' }));
    await userEvent.type(screen.getByLabelText('Servings'), '8');
    await userEvent.type(screen.getByLabelText('Prep (min)'), '30');
    await userEvent.type(screen.getByLabelText('Cook (min)'), '35');
    await userEvent.type(screen.getByLabelText('Ingredient 1 quantity'), '200');
    await userEvent.type(screen.getByLabelText('Ingredient 1 unit'), 'g');
    await userEvent.type(screen.getByLabelText('Ingredient 1 name'), 'blueberries');
    await userEvent.type(screen.getByLabelText('Step 1'), 'Bake.');
    await userEvent.upload(screen.getByLabelText('Choose a photo'), new File(['x'], 'tart.png', { type: 'image/png' }));
    await screen.findByRole('img', { name: "Your recipe's photo" });
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Tart' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Quick facts' })).toHaveTextContent('Serves 8');
    expect(screen.getByText('200 g')).toBeInTheDocument();

    const api = await import('../../services/recipesApi');
    const { items } = await api.listRecipes(tokenFor('lori'), { q: 'Tart' });
    expect(items[0].imageId).toBeTruthy();
    expect(items[0].chapterId).toBeTruthy();
  });

  it('should remove the photo', async () => {
    await openNew();
    await userEvent.upload(screen.getByLabelText('Choose a photo'), new File(['x'], 'tart.png', { type: 'image/png' }));
    await screen.findByRole('img', { name: "Your recipe's photo" });
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByRole('button', { name: /Add a photo/ })).toBeInTheDocument();
  });

  it('should edit an existing recipe and keep the date added', async () => {
    const api = await import('../../services/recipesApi');
    const token = tokenFor('lori');
    const { items } = await api.listRecipes(token, { q: 'Banana' });
    const original = await api.getRecipe(token, items[0].id);
    renderBox(<RecipeBox />, `/recipes/${original.id}/edit`);
    const title = await screen.findByLabelText('Recipe name');
    await waitFor(() => expect(title).toHaveValue("Grandma's Banana Bread"));
    expect(screen.getAllByLabelText(/^Ingredient \d+ name$/)).toHaveLength(original.ingredients.length);
    await userEvent.clear(title);
    await userEvent.type(title, 'Banana Loaf');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Banana Loaf' })).toBeInTheDocument();
    const saved = await api.getRecipe(token, original.id);
    expect(saved.createdAt).toBe(original.createdAt);
  });

  it('should show the server message when saving fails', async () => {
    const api = await import('../../services/recipesApi');
    vi.spyOn(api, 'createRecipe').mockRejectedValueOnce(new Error('The kitchen is closed.'));
    await openNew();
    await userEvent.type(screen.getByLabelText('Recipe name'), 'Tart');
    await userEvent.type(screen.getByLabelText('Ingredient 1 name'), 'jam');
    await userEvent.type(screen.getByLabelText('Step 1'), 'Eat.');
    await userEvent.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(await screen.findByText('The kitchen is closed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save recipe' })).toBeEnabled();
  });
});
