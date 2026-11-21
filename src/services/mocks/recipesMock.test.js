import { beforeEach, describe, expect, it } from 'vitest';
import { configureMock, getImageBlob, handleRequest, peekImage, resetMock } from './recipesMock';

const tokenFor = (sub) => `${btoa('{}')}.${btoa(JSON.stringify({ sub }))}.sig`;
const LORI = tokenFor('lori');
const CHANGMIN = tokenFor('changmin');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const call = (method, path, token = LORI, extra = {}) => handleRequest(method, path, { token, ...extra });
const recipe = (overrides = {}) => ({
  title: 'Test toast',
  ingredients: [{ quantity: '2', unit: '', name: 'Eggs', note: '' }, { quantity: '1', unit: 'slice', name: 'Bread', note: '' }],
  instructions: ['Toast it.'],
  ...overrides,
});

describe('recipesMock', () => {
  beforeEach(() => {
    resetMock();
    configureMock({ latencyMs: 0 });
  });

  it('should keep one private book per user and create an empty one on first read', async () => {
    const lori = await call('GET', '/recipe-book');
    const changmin = await call('GET', '/recipe-book', CHANGMIN);
    const fresh = await call('GET', '/recipe-book', tokenFor('newbie'));

    expect(lori.recipeCount).toBe(8);
    expect(changmin.recipeCount).toBe(2);
    expect(fresh.title).toBe("newbie's Recipe Book");
    expect(fresh.coverColor).toBe('rose');
    expect(fresh.chapters.map((c) => c.tabColor)).toEqual(['amber', 'sage', 'rose', 'teal', 'coral', 'plum', 'sky']);
    expect(fresh.recipeCount).toBe(0);
  });

  it('should answer 404 for another user\'s recipe and photo', async () => {
    const { items } = await call('GET', '/recipes', CHANGMIN);
    await expect(call('GET', `/recipes/${items[0].id}`)).rejects.toMatchObject({ status: 404 });
    const withPhoto = (await call('GET', '/recipes')).items.find((r) => r.imageId);
    await expect(getImageBlob(CHANGMIN, withPhoto.imageId)).rejects.toMatchObject({ status: 404 });
    await expect(handleRequest('GET', '/recipes', {})).rejects.toMatchObject({ status: 401 });
  });

  it('should AND ingredient filters, fold plurals and match single words of longer names', async () => {
    const both = await call('GET', '/recipes', LORI, { query: { ingredient: ['Eggs', 'flour'] } });
    expect(both.items.map((r) => r.title).sort()).toEqual(["Grandma's Banana Bread", 'Strawberry Shortcake', 'Sunday Buttermilk Pancakes']);
    expect(both.total).toBe(3);

    const tomato = await call('GET', '/recipes', LORI, { query: { ingredient: 'tomatoes' } });
    expect(tomato.items.map((r) => r.title).sort()).toEqual(['Roasted Tomato & Basil Soup', 'Shakshuka for Two']);

    const phrase = await call('GET', '/recipes', LORI, { query: { ingredient: 'green beans' } });
    expect(phrase.items.map((r) => r.title)).toEqual(['Garlic Butter Green Beans']);
  });

  it('should search titles case-insensitively and list newest first', async () => {
    const { items } = await call('GET', '/recipes', LORI, { query: { q: 'PANCAKE' } });
    expect(items.map((r) => r.title)).toEqual(['Sunday Buttermilk Pancakes']);
    const all = (await call('GET', '/recipes')).items;
    expect(all[0].title).toBe('Pink Lemonade');
    expect(Object.keys(all[0]).sort()).toEqual(
      ['chapterId', 'cookMinutes', 'createdAt', 'id', 'imageId', 'ingredientNames', 'prepMinutes', 'servings', 'title'].sort()
    );
  });

  it('should build the ingredient index A to Z from normalized names', async () => {
    const { entries } = await call('GET', '/recipes/ingredients');
    const names = entries.map((e) => e.name);
    expect(names).toEqual([...names].sort());
    expect(entries.find((e) => e.name === 'egg').recipes.length).toBe(4);
  });

  it('should keep the date added when a recipe is updated', async () => {
    const created = await call('POST', '/recipes', LORI, { body: recipe() });
    expect(created.ingredientNames).toEqual(['egg', 'bread']);
    await new Promise((r) => setTimeout(r, 5));
    const updated = await call('PUT', `/recipes/${created.id}`, LORI, { body: recipe({ title: 'Better toast' }) });
    expect(updated.title).toBe('Better toast');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it('should reject invalid recipes with 400', async () => {
    await expect(call('POST', '/recipes', LORI, { body: recipe({ title: '' }) })).rejects.toMatchObject({ status: 400 });
    await expect(call('POST', '/recipes', LORI, { body: recipe({ ingredients: [] }) })).rejects.toMatchObject({ status: 400 });
    await expect(call('POST', '/recipes', LORI, { body: recipe({ instructions: [] }) })).rejects.toMatchObject({ status: 400 });
    await expect(call('POST', '/recipes', LORI, { body: recipe({ servings: 0 }) })).rejects.toMatchObject({ status: 400 });
    await expect(call('POST', '/recipes', LORI, { body: recipe({ chapterId: 'nope' }) })).rejects.toMatchObject({ status: 400 });
  });

  it('should move recipes to Unsorted when their chapter is removed, and reject a duplicate chapter id', async () => {
    const book = await call('GET', '/recipe-book');
    const breakfast = book.chapters[0];
    const saved = await call('PUT', '/recipe-book', LORI, {
      body: { title: 'Mine', coverColor: 'forest', chapters: [...book.chapters.slice(1), { name: 'Brunch', tabColor: '#ffaa00' }, { id: 'unknown', name: 'Snacks', tabColor: 'sky' }] },
    });
    expect(saved.chapters.some((c) => c.id === breakfast.id)).toBe(false);
    expect(saved.chapters.at(-1).id).not.toBe('unknown');
    expect(saved.chapters.at(-2).tabColor).toBe('#ffaa00');
    const loose = (await call('GET', '/recipes')).items.filter((r) => r.chapterId === null);
    expect(loose.map((r) => r.title).sort()).toEqual(['Shakshuka for Two', 'Sunday Buttermilk Pancakes']);

    const dup = { title: 'x', coverColor: 'rose', chapters: [saved.chapters[0], saved.chapters[0]] };
    await expect(call('PUT', '/recipe-book', LORI, { body: dup })).rejects.toMatchObject({ status: 400 });
    await expect(call('PUT', '/recipe-book', LORI, { body: { ...dup, chapters: [], coverColor: 'teal' } })).rejects.toMatchObject({ status: 400 });
  });

  it('should claim an uploaded photo on save, replace it, and delete it with the recipe', async () => {
    const first = await call('POST', '/recipe-images', LORI, { body: { mimeType: 'image/png', dataBase64: PNG } });
    expect(peekImage(first.id).expiresAt).toBeTruthy();
    const created = await call('POST', '/recipes', LORI, { body: recipe({ imageId: first.id }) });
    expect(peekImage(first.id)).toMatchObject({ recipeId: created.id });
    expect(peekImage(first.id).expiresAt).toBeUndefined();

    const second = await call('POST', '/recipe-images', LORI, { body: { mimeType: 'image/png', dataBase64: PNG } });
    await call('PUT', `/recipes/${created.id}`, LORI, { body: recipe({ imageId: second.id }) });
    expect(peekImage(first.id)).toBeUndefined();

    const deleted = await call('DELETE', `/recipes/${created.id}`);
    expect(deleted).toEqual({ id: created.id, deleted: true });
    expect(peekImage(second.id)).toBeUndefined();
  });

  it('should refuse photos that are not PNG, JPEG or WebP, or belong to someone else', async () => {
    await expect(call('POST', '/recipe-images', LORI, { body: { mimeType: 'image/gif', dataBase64: PNG } })).rejects.toMatchObject({ status: 400 });
    await expect(call('POST', '/recipe-images', LORI, { body: { mimeType: 'image/png', dataBase64: btoa('hello') } })).rejects.toMatchObject({ status: 400 });
    const theirs = await call('POST', '/recipe-images', CHANGMIN, { body: { mimeType: 'image/png', dataBase64: PNG } });
    await expect(call('POST', '/recipes', LORI, { body: recipe({ imageId: theirs.id }) })).rejects.toMatchObject({ status: 400 });
  });
});
