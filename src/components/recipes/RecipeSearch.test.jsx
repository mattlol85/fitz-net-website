import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeSearch from './RecipeSearch';

const chapters = [
  { id: 'c1', name: 'Breakfast', tabColor: 'amber', recipeCount: 2 },
  { id: 'c2', name: 'Mains', tabColor: 'rose', recipeCount: 1 },
];
const ingredientIndex = {
  entries: [
    { name: 'egg', recipes: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] },
    { name: 'eggplant', recipes: [{ id: 'c', title: 'C' }] },
    { name: 'flour', recipes: [{ id: 'a', title: 'A' }] },
  ],
};

function setup(props = {}) {
  const onChange = vi.fn();
  render(
    <RecipeSearch
      q=""
      ingredients={[]}
      chapterId=""
      chapters={chapters}
      total={3}
      unsortedCount={0}
      ingredientIndex={ingredientIndex}
      onChange={onChange}
      {...props}
    />
  );
  return onChange;
}

describe('RecipeSearch', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('should debounce the title search', async () => {
    const onChange = setup();
    await userEvent.type(screen.getByLabelText('Search by name'), 'pan');
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ q: 'pan' });
  });

  it('should follow the URL when the query is cleared elsewhere', () => {
    const { rerender } = render(
      <RecipeSearch q="pie" ingredients={[]} chapterId="" chapters={chapters} total={1} unsortedCount={0} ingredientIndex={ingredientIndex} onChange={() => {}} />
    );
    expect(screen.getByLabelText('Search by name')).toHaveValue('pie');
    rerender(<RecipeSearch q="" ingredients={[]} chapterId="" chapters={chapters} total={1} unsortedCount={0} ingredientIndex={ingredientIndex} onChange={() => {}} />);
    expect(screen.getByLabelText('Search by name')).toHaveValue('');
  });

  it('should suggest ingredients as you type and add the chosen one as a chip', async () => {
    const onChange = setup();
    const box = screen.getByRole('combobox');
    await userEvent.type(box, 'egg');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['egg2 recipes', 'eggplant1 recipe']);
    expect(box).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith({ ingredients: ['eggplant'] });
  });

  it('should add typed text on Enter and ignore duplicates', async () => {
    const onChange = setup({ ingredients: ['egg'] });
    const box = screen.getByRole('combobox');
    await userEvent.type(box, 'Eggs{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.type(box, 'butter{Enter}');
    expect(onChange).toHaveBeenCalledWith({ ingredients: ['egg', 'butter'] });
  });

  it('should hide already chosen ingredients from the suggestions', async () => {
    setup({ ingredients: ['egg'] });
    await userEvent.type(screen.getByRole('combobox'), 'egg');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['eggplant1 recipe']);
  });

  it('should remove a chip with its button or with Backspace', async () => {
    const onChange = setup({ ingredients: ['egg', 'flour'] });
    await userEvent.click(screen.getByRole('button', { name: 'Remove egg' }));
    expect(onChange).toHaveBeenLastCalledWith({ ingredients: ['flour'] });
    await userEvent.type(screen.getByRole('combobox'), '{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith({ ingredients: ['egg'] });
  });

  it('should pick a chapter pill and mark the active one', async () => {
    const onChange = setup({ chapterId: 'c2', unsortedCount: 2 });
    expect(screen.getByRole('button', { name: /^Mains/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: /^Breakfast/ }));
    expect(onChange).toHaveBeenCalledWith({ chapterId: 'c1' });
    await userEvent.click(screen.getByRole('button', { name: /^Unsorted/ }));
    expect(onChange).toHaveBeenCalledWith({ chapterId: 'unsorted' });
    await userEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(onChange).toHaveBeenCalledWith({ chapterId: '' });
  });

  it('should only show the Unsorted pill when something is unsorted', () => {
    setup();
    expect(screen.queryByRole('button', { name: /^Unsorted/ })).not.toBeInTheDocument();
  });
});
