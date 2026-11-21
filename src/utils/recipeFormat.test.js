import { describe, expect, it } from 'vitest';
import { countLabel, formatAdded, formatMinutes, totalMinutes } from './recipeFormat';

describe('recipeFormat', () => {
  it('should format minutes as hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(75)).toBe('1 h 15 min');
    expect(formatMinutes(0)).toBe('');
    expect(formatMinutes(null)).toBe('');
  });

  it('should add prep and cook time, or return null when neither is set', () => {
    expect(totalMinutes({ prepMinutes: 10, cookMinutes: 20 })).toBe(30);
    expect(totalMinutes({ prepMinutes: null, cookMinutes: 5 })).toBe(5);
    expect(totalMinutes({ prepMinutes: null, cookMinutes: null })).toBeNull();
    expect(totalMinutes({ prepMinutes: 0, cookMinutes: 0 })).toBeNull();
  });

  it('should format the added date like Nov 20, 2026', () => {
    expect(formatAdded('2026-11-20T12:00:00.000Z')).toBe('Nov 20, 2026');
    expect(formatAdded('nonsense')).toBe('');
    expect(formatAdded(undefined)).toBe('');
  });

  it('should pluralise counts', () => {
    expect(countLabel(1, 'recipe')).toBe('1 recipe');
    expect(countLabel(3, 'recipe')).toBe('3 recipes');
  });
});
