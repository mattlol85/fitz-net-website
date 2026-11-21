import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeCard, { matchedIngredients } from './RecipeCard';
import { resetStore, stubObjectUrls } from './recipeTestUtils';

vi.mock('../../contexts/AuthContext', async () => (await import('./recipeTestUtils')).authModule('lori'));
vi.mock('../../services/recipesApi', async () => (await import('./recipeTestUtils')).recipesApiModule());

const recipe = {
  id: 'r 1',
  title: 'Pancakes',
  chapterId: 'c1',
  imageId: null,
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 20,
  ingredientNames: ['egg', 'all purpose flour', 'butter'],
  createdAt: '2026-11-20T12:00:00.000Z',
};
const chapter = { id: 'c1', name: 'Breakfast', tabColor: 'amber' };

const show = (props) =>
  render(
    <MemoryRouter>
      <RecipeCard recipe={recipe} chapter={chapter} {...props} />
    </MemoryRouter>
  );

describe('RecipeCard', () => {
  beforeEach(async () => {
    await resetStore();
    stubObjectUrls();
  });

  it('should link the title to the recipe and show its facts', () => {
    show();
    expect(screen.getByRole('link', { name: 'Pancakes' })).toHaveAttribute('href', '/recipes/r%201');
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('4 servings')).toBeInTheDocument();
    expect(screen.getByText(/30 min/)).toBeInTheDocument();
    expect(screen.getByText('Added Nov 20, 2026')).toBeInTheDocument();
  });

  it('should call a lone serving a serving and skip facts that are not set', () => {
    show({ recipe: { ...recipe, servings: 1, prepMinutes: null, cookMinutes: null } });
    expect(screen.getByText('1 serving')).toBeInTheDocument();
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });

  it('should label a recipe with no chapter as Unsorted', () => {
    show({ chapter: undefined });
    expect(screen.getByText('Unsorted')).toBeInTheDocument();
  });

  it('should highlight the ingredients that matched the search', () => {
    const { container } = show({ searched: ['Eggs', 'flour'] });
    const marks = [...container.querySelectorAll('mark')].map((m) => m.textContent);
    expect(marks).toEqual(['egg', 'all purpose flour']);
  });

  it('should list no matches when nothing was searched', () => {
    const { container } = show({ searched: [] });
    expect(container.querySelector('mark')).toBeNull();
  });

  it('should match an ingredient by any word of its name', () => {
    expect(matchedIngredients({ ingredientNames: ['chicken thigh', 'salt'] }, ['thighs'])).toEqual(['chicken thigh']);
    expect(matchedIngredients({ ingredientNames: ['salt'] }, ['pepper'])).toEqual([]);
  });
});
