import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeBox from './RecipeBox';
import { renderBox, resetStore, stubObjectUrls, tokenFor } from './recipeTestUtils';

vi.mock('../../contexts/AuthContext', async () => (await import('./recipeTestUtils')).authModule('lori'));
vi.mock('../../services/recipesApi', async () => (await import('./recipeTestUtils')).recipesApiModule());

const openSettings = async () => {
  renderBox(<RecipeBox />, '/recipes/settings');
  await screen.findByRole('heading', { level: 1, name: 'Book settings' });
};
const book = async () => (await import('../../services/recipesApi')).getRecipeBook(tokenFor('lori'));

describe('RecipeSettings', () => {
  beforeEach(async () => {
    await resetStore();
    stubObjectUrls();
  });

  it('should list the book name, the six cover colours and every chapter', async () => {
    await openSettings();
    expect(screen.getByLabelText('Book name')).toHaveValue("Lori's Recipe Book");
    const covers = within(screen.getByRole('group', { name: 'Cover colour' })).getAllByRole('radio');
    expect(covers).toHaveLength(6);
    expect(screen.getByRole('radio', { name: 'Rose' })).toBeChecked();
    expect(screen.getByLabelText('Chapter 1 name')).toHaveValue('Breakfast');
    expect(screen.getAllByLabelText(/^Chapter \d+ name$/)).toHaveLength(7);
  });

  it('should save a new cover colour and name', async () => {
    await openSettings();
    await userEvent.click(screen.getByRole('radio', { name: 'Forest' }));
    const name = screen.getByLabelText('Book name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Green Book');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/recipes$/));
    const saved = await book();
    expect(saved.coverColor).toBe('forest');
    expect(saved.title).toBe('Green Book');
  });

  it('should rename, recolour and reorder chapters', async () => {
    await openSettings();
    const first = screen.getByLabelText('Chapter 1 name');
    await userEvent.clear(first);
    await userEvent.type(first, 'Brunch');
    const row = first.closest('li');
    await userEvent.click(within(row).getByRole('radio', { name: 'plum' }));
    await userEvent.click(screen.getByRole('button', { name: 'Move Brunch down' }));
    expect(screen.getByLabelText('Chapter 2 name')).toHaveValue('Brunch');
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/recipes$/));
    const saved = await book();
    expect(saved.chapters[1]).toMatchObject({ name: 'Brunch', tabColor: 'plum' });
    expect(saved.chapters[0].name).toBe('Soups & Salads');
  });

  it('should add a chapter and delete one, moving its recipes to Unsorted', async () => {
    await openSettings();
    await userEvent.click(screen.getByRole('button', { name: 'Add chapter' }));
    await userEvent.type(screen.getByLabelText('Chapter 8 name'), 'Snacks');
    await userEvent.click(screen.getByRole('button', { name: 'Delete Desserts' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/recipes$/));
    const saved = await book();
    expect(saved.chapters.map((c) => c.name)).toContain('Snacks');
    expect(saved.chapters.map((c) => c.name)).not.toContain('Desserts');
    expect(saved.recipeCount).toBe(8);
    expect(await screen.findByRole('button', { name: /^Unsorted/ })).toBeInTheDocument();
  });

  it('should not save a chapter without a name', async () => {
    await openSettings();
    await userEvent.click(screen.getByRole('button', { name: 'Add chapter' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Every chapter needs a name.');
    expect(screen.getByTestId('location')).toHaveTextContent('/recipes/settings');
  });

  it('should keep the Add chapter button off at twenty chapters', async () => {
    await openSettings();
    const add = screen.getByRole('button', { name: 'Add chapter' });
    for (let i = 0; i < 13; i += 1) await userEvent.click(add);
    expect(screen.getAllByLabelText(/^Chapter \d+ name$/)).toHaveLength(20);
    expect(add).toBeDisabled();
  });
});
