import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from './recipesApi';

vi.mock('../utils/imageDownsize', () => ({
  downsizeImage: vi.fn(async () => ({ blob: new Blob(['jpeg-bytes'], { type: 'image/jpeg' }), name: 'p.jpg', width: 10, height: 10 })),
}));

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubFetch(body = {}) {
  const fetchMock = vi.fn().mockImplementation(async () => json(body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const last = (fetchMock) => {
  const [url, options] = fetchMock.mock.calls.at(-1);
  return { url: url.replace(/^.*?\/(recipe)/, '/$1'), method: options.method || 'GET', body: options.body && JSON.parse(options.body), headers: options.headers };
};

describe('recipesApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('should read and replace the book', async () => {
    const f = stubFetch({ id: 'b' });
    await api.getRecipeBook('jwt');
    expect(last(f)).toMatchObject({ url: '/recipe-book', method: 'GET' });
    expect(last(f).headers.Authorization).toBe('Bearer jwt');

    await api.updateRecipeBook('jwt', { title: 'T', coverColor: 'navy', chapters: [{ name: 'A', tabColor: 'sky' }], extra: 1 });
    expect(last(f)).toMatchObject({ url: '/recipe-book', method: 'PUT', body: { title: 'T', coverColor: 'navy', chapters: [{ name: 'A', tabColor: 'sky' }] } });
  });

  it('should repeat the ingredient parameter for an AND search', async () => {
    const f = stubFetch({ items: [], total: 0 });
    await api.listRecipes('jwt', { ingredients: ['egg', 'flour'], q: 'pan' });
    expect(last(f).url).toBe('/recipes?ingredient=egg&ingredient=flour&q=pan');
  });

  it('should call each recipe endpoint with the right method and path', async () => {
    const f = stubFetch({});
    await api.getIngredientIndex('jwt');
    expect(last(f)).toMatchObject({ url: '/recipes/ingredients', method: 'GET' });
    await api.getRecipe('jwt', 'a/b');
    expect(last(f).url).toBe('/recipes/a%2Fb');
    await api.createRecipe('jwt', { title: 'x' });
    expect(last(f)).toMatchObject({ url: '/recipes', method: 'POST', body: { title: 'x' } });
    await api.updateRecipe('jwt', 'r1', { title: 'y' });
    expect(last(f)).toMatchObject({ url: '/recipes/r1', method: 'PUT' });
    await api.deleteRecipe('jwt', 'r1');
    expect(last(f)).toMatchObject({ url: '/recipes/r1', method: 'DELETE' });
  });

  it('should fetch photo bytes as a blob', async () => {
    const f = vi.fn().mockResolvedValue(new Response('img'));
    vi.stubGlobal('fetch', f);
    const blob = await api.fetchRecipeImage('jwt', 'img1');
    expect(blob.size).toBe(3);
    expect(f.mock.calls[0][0]).toMatch(/\/recipe-images\/img1$/);
  });

  it('should shrink, encode and upload a picked photo', async () => {
    const f = stubFetch({ id: 'img9', mimeType: 'image/jpeg' });
    const file = new File(['raw'], 'photo.png', { type: 'image/png' });
    const { image, preview } = await api.uploadRecipePhoto('jwt', file);
    expect(image.id).toBe('img9');
    expect(preview.type).toBe('image/jpeg');
    expect(last(f)).toMatchObject({ url: '/recipe-images', method: 'POST', body: { mimeType: 'image/jpeg', dataBase64: btoa('jpeg-bytes') } });
  });

  it('should refuse a file that is not an image before uploading', async () => {
    const f = stubFetch({});
    await expect(api.uploadRecipePhoto('jwt', new File(['x'], 'a.gif', { type: 'image/gif' }))).rejects.toThrow(/PNG, JPEG and WebP/);
    expect(f).not.toHaveBeenCalled();
  });
});
