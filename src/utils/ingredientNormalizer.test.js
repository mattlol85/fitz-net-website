import { describe, expect, it } from 'vitest';
import { ingredientTerms, normalizeIngredient, singularize } from './ingredientNormalizer';

describe('ingredientNormalizer', () => {
  it('should fold the common plural endings of the last word', () => {
    expect(singularize('eggs')).toBe('egg');
    expect(singularize('tomatoes')).toBe('tomato');
    expect(singularize('berries')).toBe('berry');
    expect(singularize('dishes')).toBe('dish');
    expect(singularize('boxes')).toBe('box');
  });

  it('should leave words the rules would mangle alone', () => {
    expect(singularize('glass')).toBe('glass');
    expect(singularize('cookies')).toBe('cookie');
    expect(singularize('pies')).toBe('pie');
    expect(singularize('leaves')).toBe('leaf');
    expect(singularize('molasses')).toBe('molasses');
    expect(singularize('asparagus')).toBe('asparagus');
    expect(singularize('gas')).toBe('gas');
  });

  it('should lowercase, drop apostrophes, split other punctuation and only singularize the last word', () => {
    expect(normalizeIngredient('  Fresh   Eggs! ')).toBe('fresh egg');
    expect(normalizeIngredient("Baker's Chocolate Chips")).toBe('bakers chocolate chip');
    expect(normalizeIngredient('All-Purpose Flour')).toBe('all purpose flour');
    expect(normalizeIngredient('')).toBe('');
  });

  it('should index a name by itself and each word of three letters or more', () => {
    expect(ingredientTerms('chicken thigh')).toEqual(['chicken thigh', 'chicken', 'thigh']);
    expect(ingredientTerms('red pepper')).toEqual(['red pepper', 'red', 'pepper']);
    expect(ingredientTerms('ox tail')).toEqual(['ox tail', 'tail']);
    expect(ingredientTerms('')).toEqual([]);
  });
});
