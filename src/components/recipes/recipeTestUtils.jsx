/**
 * Shared harness for the recipe box tests (not a test file itself). A test file calls
 *   vi.mock('../../contexts/AuthContext', async () => (await import('./recipeTestUtils')).authModule('lori'))
 *   vi.mock('../../services/recipesApi', async () => (await import('./recipeTestUtils')).recipesApiModule())
 * and the box then runs against the in-memory mock API (services/mocks/recipesMock.js) with no
 * latency, so the tests exercise real data through the real components.
 */
import React from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/** A JWT-shaped token whose payload names `username`, the way the mock API identifies callers. */
export function tokenFor(username) {
  const enc = (o) => btoa(JSON.stringify(o));
  return `${enc({ alg: 'HS384' })}.${enc({ sub: username, exp: 4102444800 })}.sig`;
}

/** The AuthContext module, signed in as `username`. */
export function authModule(username = 'lori') {
  const value = {
    user: { username },
    token: tokenFor(username),
    isAuthenticated: () => true,
    hasPermission: () => true,
  };
  return { useAuth: () => value };
}

/** A recipesApi module backed by the mock API. */
export async function recipesApiModule() {
  const actual = await vi.importActual('../../services/recipesApi');
  const mock = await import('../../services/mocks/recipesMock');
  mock.configureMock({ latencyMs: 0 });
  const call = (method, path, options) => mock.handleRequest(method, path, options);
  return {
    ...actual,
    getRecipeBook: async (token) => call('GET', '/recipe-book', { token }),
    updateRecipeBook: async (token, body) => call('PUT', '/recipe-book', { token, body }),
    listRecipes: async (token, { ingredients, q, chapterId } = {}) =>
      call('GET', '/recipes', { token, query: { ingredient: ingredients, q, chapterId } }),
    getIngredientIndex: async (token) => call('GET', '/recipes/ingredients', { token }),
    getRecipe: async (token, id) => call('GET', `/recipes/${encodeURIComponent(id)}`, { token }),
    createRecipe: async (token, body) => call('POST', '/recipes', { token, body }),
    updateRecipe: async (token, id, body) => call('PUT', `/recipes/${encodeURIComponent(id)}`, { token, body }),
    deleteRecipe: async (token, id) => call('DELETE', `/recipes/${encodeURIComponent(id)}`, { token }),
    fetchRecipeImage: async (token, id) => mock.getImageBlob(token, id),
    // The real one shrinks the picture on a canvas, which jsdom does not have.
    uploadRecipePhoto: async (token) => {
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const image = await call('POST', '/recipe-images', { token, body: { mimeType: 'image/png', dataBase64: png } });
      return { image, preview: new Blob(['x'], { type: 'image/png' }) };
    },
  };
}

/** Resets the mock store to its seeded state. */
export async function resetStore() {
  const mock = await import('../../services/mocks/recipesMock');
  mock.resetMock();
  mock.configureMock({ latencyMs: 0 });
}

/** Shows the current location so tests can assert where a click went. */
export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

/** Renders `ui` inside a router at `path`, with the location probe alongside. */
export function renderAt(ui, path = '/recipes') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>
  );
}

/** Gives jsdom the object-URL functions the photo code uses. */
export function stubObjectUrls() {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test-${++n}`);
  URL.revokeObjectURL = vi.fn();
}

/** Renders `element` at /recipes/* the way App.jsx mounts the recipe box. */
export function renderBox(element, path = '/recipes') {
  return renderAt(
    <Routes>
      <Route path="/recipes/*" element={element} />
      <Route path="*" element={<p>elsewhere</p>} />
    </Routes>,
    path
  );
}
