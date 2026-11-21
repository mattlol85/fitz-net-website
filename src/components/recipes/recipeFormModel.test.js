import { describe, expect, it } from 'vitest';
import { LIMITS, toForm, toRequest } from './recipeFormModel';

const filled = () => {
  const form = toForm(null, 'ch1');
  form.title = '  Pancakes ';
  form.ingredients[0] = { ...form.ingredients[0], quantity: '2', unit: 'cups', name: ' flour ' };
  form.steps[0] = { ...form.steps[0], text: ' Mix. ' };
  return form;
};

describe('recipeFormModel', () => {
  it('should start a new recipe with a few blank rows in the chosen chapter', () => {
    const form = toForm(null, 'ch1');
    expect(form.chapterId).toBe('ch1');
    expect(form.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(form.steps.length).toBeGreaterThanOrEqual(2);
    expect(new Set(form.ingredients.map((r) => r.key)).size).toBe(form.ingredients.length);
  });

  it('should build the request from trimmed values and skip blank rows', () => {
    const { body, errors } = toRequest(filled());
    expect(errors).toEqual({});
    expect(body).toEqual({
      title: 'Pancakes',
      chapterId: 'ch1',
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      ingredients: [{ quantity: '2', unit: 'cups', name: 'flour', note: '' }],
      instructions: ['Mix.'],
      imageId: null,
    });
  });

  it('should round-trip an existing recipe', () => {
    const recipe = {
      title: 'Soup',
      chapterId: null,
      servings: 4,
      prepMinutes: 0,
      cookMinutes: 30,
      ingredients: [{ quantity: '1', unit: '', name: 'onion', note: 'diced' }],
      instructions: ['Cook it.'],
      imageId: 'img1',
    };
    const { body, errors } = toRequest(toForm(recipe));
    expect(errors).toEqual({});
    expect(body).toMatchObject({ title: 'Soup', chapterId: null, servings: 4, prepMinutes: 0, cookMinutes: 30, imageId: 'img1' });
    expect(body.ingredients).toEqual(recipe.ingredients);
  });

  it('should report a missing title, ingredients and steps', () => {
    const { errors } = toRequest(toForm(null));
    expect(errors.title).toBeTruthy();
    expect(errors.ingredients).toBeTruthy();
    expect(errors.instructions).toBeTruthy();
  });

  it('should flag an ingredient row that has details but no name', () => {
    const form = filled();
    form.ingredients[1] = { ...form.ingredients[1], quantity: '3' };
    const { errors } = toRequest(form);
    expect(errors.rows[form.ingredients[1].key]).toMatch(/needs a name/);
  });

  it('should mirror the API limits', () => {
    const form = filled();
    form.title = 'x'.repeat(LIMITS.title + 1);
    form.ingredients[0].name = 'y'.repeat(LIMITS.ingredientName + 1);
    form.steps[0].text = 'z'.repeat(LIMITS.step + 1);
    form.servings = '0';
    form.prepMinutes = '1441';
    form.cookMinutes = '2.5';
    const { errors } = toRequest(form);
    expect(errors.title).toBeTruthy();
    expect(errors.rows[form.ingredients[0].key]).toMatch(/80/);
    expect(errors.rows[form.steps[0].key]).toMatch(/2000/);
    expect(errors.servings).toMatch(/1 to 100/);
    expect(errors.prepMinutes).toMatch(/0 to 1440/);
    expect(errors.cookMinutes).toMatch(/whole number/);
  });
});
