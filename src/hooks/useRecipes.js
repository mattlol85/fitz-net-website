import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useAuthedObjectUrl from './useAuthedObjectUrl';
import {
  fetchRecipeImage,
  getIngredientIndex,
  getRecipe,
  getRecipeBook,
  listRecipes,
} from '../services/recipesApi';

/**
 * Data hooks for the recipe box. Each returns `{ data, error, loading, reload }` like
 * useJoenetResource: `error` is the server's message, previous data stays on screen while a new
 * request is in flight, and nothing is fetched while signed out or while `key` is null.
 * `version` is bumped by the recipe box after every save or delete so lists refetch.
 */
function useResource(load, key) {
  const { token } = useAuth();
  const [state, setState] = useState({ data: null, error: '', loading: Boolean(token) && key !== null });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!token || key === null) {
      setState({ data: null, error: '', loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState((prev) => ({ ...prev, error: '', loading: true }));
    load(token, controller.signal).then(
      (data) => !controller.signal.aborted && setState({ data, error: '', loading: false }),
      (err) =>
        !controller.signal.aborted &&
        setState((prev) => ({ data: prev.data, error: err.message || 'Something went wrong.', loading: false }))
    );
    return () => controller.abort();
    // `load` is rebuilt every render on purpose; `key` says when what it loads changed.
  }, [token, key, reloadCount]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  return { ...state, reload };
}

/** The signed-in user's book: title, cover colour and chapters with their recipe counts. */
export function useRecipeBook(version = 0) {
  return useResource((token, signal) => getRecipeBook(token, { signal }), `book:${version}`);
}

/**
 * Recipe summaries matching a search: `data = { items, total }`. Several `ingredients` are ANDed.
 * Newest first.
 */
export function useRecipeList({ ingredients = [], q = '', chapterId = '' } = {}, version = 0) {
  const key = `list:${version}:${q}:${chapterId}:${ingredients.join('\u0000')}`;
  return useResource(
    (token, signal) => listRecipes(token, { ingredients, q: q || undefined, chapterId: chapterId || undefined, signal }),
    key
  );
}

/** One full RecipeDto (ingredients and method); `id` falsy fetches nothing. */
export function useRecipe(id, version = 0) {
  return useResource((token, signal) => getRecipe(token, id, { signal }), id ? `recipe:${id}:${version}` : null);
}

/** Every ingredient in the book, A to Z, for autocomplete. */
export function useIngredientIndex(version = 0) {
  return useResource((token, signal) => getIngredientIndex(token, { signal }), `index:${version}`);
}

/** An object URL for a recipe photo, or `{ url: null }` while it loads (or without one). */
export function useRecipeImageUrl(imageId) {
  return useAuthedObjectUrl('recipe-image', fetchRecipeImage, imageId);
}
