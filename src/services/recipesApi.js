/**
 * Lori-Net recipe book client for fitz-net-api's `/recipe-book`, `/recipes` and `/recipe-images`
 * endpoints. One function per REST endpoint; each takes the caller's JWT first, resolves with the
 * parsed JSON body (camelCase, exactly as the API's DTOs) and throws ApiError on HTTP failures.
 *
 * Every book is private to its owner: the API scopes each call to the signed-in user and answers
 * 404 for anyone else's recipe or image.
 *
 * With VITE_USE_MOCK_API=true every call is answered by services/mocks/recipesMock.js, loaded
 * lazily so it never ships in the production path. This module deliberately shares nothing with
 * the Matt-GPT client beyond the neutral apiClient.
 */
import { USE_MOCK_API, request, requestBlob } from './apiClient';
import { downsizeImage } from '../utils/imageDownsize';
import fileToBase64 from '../utils/fileToBase64';

let mockModule = null;
const loadMock = () => {
  mockModule ??= import('./mocks/recipesMock.js');
  return mockModule;
};

async function call(method, path, { token, body, query, signal } = {}) {
  if (USE_MOCK_API) return (await loadMock()).handleRequest(method, path, { token, body, query, signal });
  return request(method, path, { token, body, query, signal });
}

const id = encodeURIComponent;

/** Photos are shrunk in the browser to this longest side before upload. */
export const PHOTO_MAX_SIDE = 1600;
/** What the API accepts (it sniffs the magic bytes too). */
export const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// --- The book ----------------------------------------------------------------------------------

/**
 * GET /recipe-book -> RecipeBookDto
 * `{ id, title, coverColor, chapters[{ id, name, tabColor, recipeCount }], recipeCount, createdAt }`.
 * The API creates the book (with its default chapters) on the first call.
 */
export const getRecipeBook = (token, { signal } = {}) => call('GET', '/recipe-book', { token, signal });

/**
 * PUT /recipe-book `{ title, coverColor, chapters[{ id?, name, tabColor }] }` -> RecipeBookDto.
 * Replaces the whole chapter list in order: entries without an id are new, and recipes in a
 * removed chapter fall back to Unsorted (chapterId unset).
 */
export const updateRecipeBook = (token, { title, coverColor, chapters }, { signal } = {}) =>
  call('PUT', '/recipe-book', { token, body: { title, coverColor, chapters }, signal });

// --- Recipes -----------------------------------------------------------------------------------

/**
 * GET /recipes?ingredient=&ingredient=&q=&chapterId= -> RecipeListDto `{ items[RecipeSummaryDto], total }`.
 * Several ingredients are ANDed ("what can I make with egg and flour"). Newest first.
 * Summary: `{ id, title, chapterId, imageId, servings, prepMinutes, cookMinutes, ingredientNames, createdAt }`.
 */
export const listRecipes = (token, { ingredients, q, chapterId, signal } = {}) =>
  call('GET', '/recipes', { token, query: { ingredient: ingredients, q, chapterId }, signal });

/** GET /recipes/ingredients -> IngredientIndexDto `{ entries[{ name, recipes[{ id, title }] }] }`, A to Z. */
export const getIngredientIndex = (token, { signal } = {}) =>
  call('GET', '/recipes/ingredients', { token, signal });

/** GET /recipes/{id} -> RecipeDto (summary fields plus `ingredients[]`, `instructions[]`, `updatedAt`). */
export const getRecipe = (token, recipeId, { signal } = {}) =>
  call('GET', `/recipes/${id(recipeId)}`, { token, signal });

/**
 * POST /recipes RecipeRequestDto -> RecipeDto. Request:
 * `{ title, chapterId?, servings?, prepMinutes?, cookMinutes?,
 *    ingredients[{ quantity?, unit?, name, note? }], instructions[], imageId? }`.
 */
export const createRecipe = (token, recipe, { signal } = {}) =>
  call('POST', '/recipes', { token, body: recipe, signal });

/** PUT /recipes/{id} RecipeRequestDto -> RecipeDto. `createdAt` (the date added) never changes. */
export const updateRecipe = (token, recipeId, recipe, { signal } = {}) =>
  call('PUT', `/recipes/${id(recipeId)}`, { token, body: recipe, signal });

/** DELETE /recipes/{id} -> `{ id, deleted }`. The recipe's photo goes with it. */
export const deleteRecipe = (token, recipeId, { signal } = {}) =>
  call('DELETE', `/recipes/${id(recipeId)}`, { token, signal });

// --- Photos ------------------------------------------------------------------------------------

/**
 * POST /recipe-images `{ mimeType, dataBase64 }` -> RecipeImageDto
 * `{ id, mimeType, sizeBytes, width, height, createdAt }`. The upload is claimed when a recipe is
 * saved with its id; an unclaimed one expires on the server.
 */
export const uploadRecipeImage = (token, { mimeType, dataBase64 }, { signal } = {}) =>
  call('POST', '/recipe-images', { token, body: { mimeType, dataBase64 }, signal });

/**
 * GET /recipe-images/{id} -> Blob. `<img>` cannot send the bearer token, so pages show it through
 * an object URL (hooks/useAuthedObjectUrl.js).
 */
export async function fetchRecipeImage(token, imageId, { signal } = {}) {
  if (USE_MOCK_API) return (await loadMock()).getImageBlob(token, imageId);
  return requestBlob(`/recipe-images/${id(imageId)}`, { token, signal, fallback: 'Failed to load the photo' });
}

/**
 * Shrinks a picked photo (longest side 1600 px, JPEG), uploads it and resolves the RecipeImageDto
 * plus a local preview Blob, so the page can show it before the server copy is fetched.
 */
export async function uploadRecipePhoto(token, file, { signal } = {}) {
  if (!PHOTO_TYPES.includes(file.type)) {
    throw new Error('Only PNG, JPEG and WebP photos can be added.');
  }
  const shrunk = await downsizeImage(file, { maxSide: PHOTO_MAX_SIDE });
  const dataBase64 = await fileToBase64(shrunk.blob);
  const image = await uploadRecipeImage(token, { mimeType: 'image/jpeg', dataBase64 }, { signal });
  return { image, preview: shrunk.blob };
}
