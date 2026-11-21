/**
 * In-memory stand-in for fitz-net-api's recipe book endpoints, used when VITE_USE_MOCK_API=true
 * so the whole book is clickable without a backend. recipesApi.js loads it with a dynamic
 * import() and never touches it otherwise.
 *
 * It follows the API contract: one private book per user (created lazily with the default
 * chapters), 404 for anything that isn't the caller's, ingredient names normalized and
 * plural-folded the same way the server does, ANDed ingredient search, the A-to-Z ingredient
 * index, removed chapters unsetting `chapterId`, and photo uploads that are claimed by the recipe
 * that saves them.
 *
 * Seeded users: `lori` (eight recipes with photos) and `changmin` (two recipes), so per-user
 * isolation is visible. Anyone else starts with an empty book.
 */
import { ApiError } from '../apiClient';
import { SEED_PHOTOS } from './recipesMockPhotos';
import { ingredientTerms, normalizeIngredient } from '../../utils/ingredientNormalizer';

export const mockConfig = { latencyMs: 120 };

export function configureMock(changes) {
  Object.assign(mockConfig, changes);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `{ ingredientNames, ingredientTerms }` derived from a recipe's ingredient rows. */
export function deriveIngredientFields(ingredients) {
  const names = [];
  ingredients.forEach((row) => {
    const name = normalizeIngredient(row.name);
    if (name && !names.includes(name)) names.push(name);
  });
  const terms = new Set(names.flatMap(ingredientTerms));
  return { ingredientNames: names, ingredientTerms: [...terms] };
}

// --- Store -----------------------------------------------------------------------------------------

const COVER_COLORS = ['rose', 'burgundy', 'forest', 'navy', 'tan', 'charcoal'];
// The API's defaults, one per default chapter. On PUT any lowercase colour name or #rrggbb is accepted.
const DEFAULT_TAB_COLORS = ['amber', 'sage', 'rose', 'teal', 'coral', 'plum', 'sky'];
const TAB_COLOR_PATTERN = /^([a-z]+|#[0-9a-f]{6})$/;
const DEFAULT_CHAPTERS = ['Breakfast', 'Soups & Salads', 'Mains', 'Sides', 'Baking', 'Desserts', 'Drinks'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

let seq = 1;
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const shortId = () => Math.random().toString(36).slice(2, 10);

let books = new Map(); // owner -> book
let recipes = new Map(); // id -> recipe
let images = new Map(); // id -> { ...meta, ownerUsername, recipeId, blob }

function createBook(owner, { title, coverColor = 'rose', chapterNames = DEFAULT_CHAPTERS, createdAt } = {}) {
  const now = createdAt || new Date().toISOString();
  const book = {
    id: newId('book'),
    ownerUsername: owner,
    title: title || `${owner}'s Recipe Book`,
    coverColor,
    chapters: chapterNames.map((name, i) => ({ id: shortId(), name, tabColor: DEFAULT_TAB_COLORS[i % DEFAULT_TAB_COLORS.length] })),
    createdAt: now,
    updatedAt: now,
  };
  books.set(owner, book);
  return book;
}

function seedRecipe(owner, chapterName, data, createdAt, photoKey) {
  const book = books.get(owner);
  const chapter = book.chapters.find((c) => c.name === chapterName);
  const id = newId('rec');
  let imageId = null;
  if (photoKey && SEED_PHOTOS[photoKey]) {
    imageId = newId('img');
    const blob = new Blob([SEED_PHOTOS[photoKey]], { type: 'image/svg+xml' });
    images.set(imageId, {
      id: imageId,
      ownerUsername: owner,
      recipeId: id,
      mimeType: 'image/svg+xml',
      sizeBytes: blob.size,
      width: 800,
      height: 800,
      createdAt,
      blob,
    });
  }
  recipes.set(id, {
    id,
    ownerUsername: owner,
    bookId: book.id,
    chapterId: chapter?.id ?? null,
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    ...data,
    imageId,
    ...deriveIngredientFields(data.ingredients),
    createdAt,
    updatedAt: createdAt,
  });
}

const ing = (quantity, unit, name, note = '') => ({ quantity, unit, name, note });

export function resetMock() {
  books = new Map();
  recipes = new Map();
  images = new Map();

  createBook('lori', { title: "Lori's Recipe Book", coverColor: 'rose', createdAt: '2026-01-04T10:00:00.000Z' });
  seedRecipe('lori', 'Breakfast', {
    title: 'Sunday Buttermilk Pancakes',
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 20,
    ingredients: [
      ing('2', 'cups', 'all-purpose flour', 'sifted'),
      ing('2', 'tbsp', 'sugar'),
      ing('2', 'tsp', 'baking powder'),
      ing('1/2', 'tsp', 'salt'),
      ing('2', '', 'eggs', 'room temperature'),
      ing('2', 'cups', 'buttermilk'),
      ing('4', 'tbsp', 'butter', 'melted, plus more for the pan'),
      ing('1', 'cup', 'blueberries', 'optional'),
    ],
    instructions: [
      'Whisk the flour, sugar, baking powder and salt together in a large bowl.',
      'In a second bowl beat the eggs, then whisk in the buttermilk and melted butter.',
      'Pour the wet into the dry and fold just until no streaks of flour remain. Lumps are good: they make the pancakes tender.',
      'Heat a buttered griddle over medium heat. Ladle 1/4 cup of batter per pancake and scatter over a few blueberries.',
      'Flip when bubbles cover the surface and the edges look set, about 2 minutes, then cook 1 minute more.',
      'Serve in a warm stack with maple syrup and a pat of butter.',
    ],
  }, '2026-02-08T09:30:00.000Z', 'pancakes');
  seedRecipe('lori', 'Breakfast', {
    title: 'Shakshuka for Two',
    servings: 2,
    prepMinutes: 10,
    cookMinutes: 25,
    ingredients: [
      ing('2', 'tbsp', 'olive oil'),
      ing('1', '', 'onion', 'finely sliced'),
      ing('1', '', 'red pepper', 'sliced'),
      ing('2', 'cloves', 'garlic', 'crushed'),
      ing('1', 'tsp', 'cumin'),
      ing('1', 'tsp', 'smoked paprika'),
      ing('1', 'can', 'tomatoes', '400 g, crushed'),
      ing('4', '', 'eggs'),
      ing('1', 'handful', 'parsley', 'chopped'),
    ],
    instructions: [
      'Warm the oil in a wide pan and soften the onion and pepper for 8 minutes.',
      'Stir in the garlic and spices and cook for a minute until fragrant.',
      'Add the tomatoes, season and simmer until thick, about 10 minutes.',
      'Make four wells, crack in the eggs, cover and cook until the whites are set but the yolks still run.',
      'Scatter with parsley and bring the pan to the table with crusty bread.',
    ],
  }, '2026-05-17T08:15:00.000Z');
  seedRecipe('lori', 'Soups & Salads', {
    title: 'Roasted Tomato & Basil Soup',
    servings: 6,
    prepMinutes: 15,
    cookMinutes: 50,
    ingredients: [
      ing('1.5', 'kg', 'ripe tomatoes', 'halved'),
      ing('1', '', 'red onion', 'quartered'),
      ing('6', 'cloves', 'garlic', 'unpeeled'),
      ing('3', 'tbsp', 'olive oil'),
      ing('750', 'ml', 'vegetable stock'),
      ing('1', 'bunch', 'basil'),
      ing('100', 'ml', 'cream', 'to finish'),
    ],
    instructions: [
      'Heat the oven to 200°C. Toss the tomatoes, onion and garlic with the oil and a big pinch of salt.',
      'Roast for 40 minutes, until the tomatoes collapse and catch at the edges.',
      'Squeeze the garlic from its skins into a pot with everything from the tray and the stock.',
      'Simmer for 10 minutes, add most of the basil and blend until silky.',
      'Swirl in the cream and finish with the last basil leaves and black pepper.',
    ],
  }, '2026-03-02T18:00:00.000Z', 'soup');
  seedRecipe('lori', 'Mains', {
    title: 'Lemon & Herb Roast Chicken',
    servings: 4,
    prepMinutes: 20,
    cookMinutes: 80,
    ingredients: [
      ing('1', '', 'whole chicken', 'about 1.6 kg'),
      ing('2', '', 'lemons'),
      ing('4', 'tbsp', 'butter', 'softened'),
      ing('1', 'head', 'garlic', 'halved'),
      ing('4', 'sprigs', 'thyme'),
      ing('2', 'sprigs', 'rosemary'),
      ing('800', 'g', 'baby potatoes'),
    ],
    instructions: [
      'Take the chicken out of the fridge an hour before roasting. Heat the oven to 220°C.',
      'Mash the butter with the zest of one lemon, chopped thyme, salt and pepper; push it under the skin.',
      'Stuff the cavity with the zested lemon, halved, the garlic and the rosemary.',
      'Sit the bird on the potatoes in a roasting tin and roast for 20 minutes, then turn down to 190°C for an hour.',
      'Rest for 15 minutes under foil while you crisp the potatoes in the hot fat.',
      'Squeeze over the second lemon and carve at the table.',
    ],
  }, '2026-04-12T17:45:00.000Z', 'chicken');
  seedRecipe('lori', 'Sides', {
    title: 'Garlic Butter Green Beans',
    servings: 4,
    prepMinutes: 5,
    cookMinutes: 8,
    ingredients: [
      ing('500', 'g', 'green beans', 'trimmed'),
      ing('2', 'tbsp', 'butter'),
      ing('3', 'cloves', 'garlic', 'thinly sliced'),
      ing('2', 'tbsp', 'toasted almonds', 'flaked'),
      ing('1/2', '', 'lemon'),
    ],
    instructions: [
      'Blanch the beans in well-salted boiling water for 3 minutes, then drain.',
      'Melt the butter in a pan and fry the garlic until just golden.',
      'Toss in the beans, the almonds and a squeeze of lemon. Season and serve at once.',
    ],
  }, '2026-06-21T12:10:00.000Z');
  seedRecipe('lori', 'Baking', {
    title: "Grandma's Banana Bread",
    servings: 10,
    prepMinutes: 15,
    cookMinutes: 60,
    ingredients: [
      ing('3', '', 'very ripe bananas'),
      ing('1/3', 'cup', 'butter', 'melted'),
      ing('3/4', 'cup', 'brown sugar'),
      ing('1', '', 'egg', 'beaten'),
      ing('1', 'tsp', 'vanilla'),
      ing('1', 'tsp', 'baking soda'),
      ing('1 1/2', 'cups', 'all-purpose flour'),
      ing('1/2', 'cup', 'walnuts', 'chopped'),
    ],
    instructions: [
      'Heat the oven to 175°C and butter a 9 by 5 inch loaf tin.',
      'Mash the bananas in a bowl, then stir in the melted butter.',
      'Mix in the sugar, egg and vanilla, then the baking soda and a pinch of salt.',
      'Fold in the flour and walnuts until just combined.',
      'Bake for 55 to 65 minutes, until a skewer comes out clean. Cool in the tin for 10 minutes.',
    ],
  }, '2026-01-19T15:00:00.000Z', 'bread');
  seedRecipe('lori', 'Desserts', {
    title: 'Strawberry Shortcake',
    servings: 6,
    prepMinutes: 25,
    cookMinutes: 18,
    ingredients: [
      ing('500', 'g', 'strawberries', 'hulled and sliced'),
      ing('3', 'tbsp', 'sugar', 'plus 2 tbsp for the berries'),
      ing('2', 'cups', 'all-purpose flour'),
      ing('1', 'tbsp', 'baking powder'),
      ing('6', 'tbsp', 'cold butter', 'cubed'),
      ing('3/4', 'cup', 'cream', 'plus more to whip'),
      ing('1', '', 'egg'),
    ],
    instructions: [
      'Toss the strawberries with 2 tbsp sugar and leave them to turn syrupy.',
      'Rub the butter into the flour, sugar, baking powder and a pinch of salt until it looks like breadcrumbs.',
      'Beat the cream with the egg, stir it in to a shaggy dough and pat out 2 cm thick.',
      'Cut six rounds and bake at 210°C for 15 to 18 minutes until golden.',
      'Split the shortcakes and fill with the berries, their juices and softly whipped cream.',
    ],
  }, '2026-07-04T14:20:00.000Z', 'shortcake');
  seedRecipe('lori', 'Drinks', {
    title: 'Pink Lemonade',
    servings: 8,
    prepMinutes: 10,
    cookMinutes: 5,
    ingredients: [
      ing('1', 'cup', 'sugar'),
      ing('1', 'cup', 'fresh lemon juice', 'about 6 lemons'),
      ing('1/2', 'cup', 'raspberries'),
      ing('6', 'cups', 'cold water'),
      ing('', '', 'ice'),
      ing('', '', 'mint', 'to serve'),
    ],
    instructions: [
      'Warm the sugar with 1 cup of the water until dissolved, then cool.',
      'Press the raspberries through a sieve to get a bright pink juice.',
      'Stir the syrup, lemon juice, raspberry juice and the rest of the water together in a jug.',
      'Pour over lots of ice and finish with mint.',
    ],
  }, '2026-08-09T16:40:00.000Z', 'lemonade');

  createBook('changmin', { coverColor: 'navy', createdAt: '2026-03-01T10:00:00.000Z' });
  seedRecipe('changmin', 'Mains', {
    title: 'Kimchi Fried Rice',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 10,
    ingredients: [
      ing('2', 'cups', 'cooked rice', 'day-old'),
      ing('1', 'cup', 'kimchi', 'chopped'),
      ing('2', '', 'eggs'),
      ing('1', 'tbsp', 'gochujang'),
    ],
    instructions: ['Fry the kimchi until it catches.', 'Add the rice and gochujang and toss.', 'Top with fried eggs.'],
  }, '2026-03-05T19:00:00.000Z');
  seedRecipe('changmin', 'Desserts', {
    title: 'Hotteok',
    servings: 6,
    ingredients: [ing('2', 'cups', 'flour'), ing('1/2', 'cup', 'brown sugar'), ing('1', 'tsp', 'cinnamon')],
    instructions: ['Make the dough.', 'Fill with sugar and cinnamon.', 'Fry flat until crisp.'],
  }, '2026-03-20T19:00:00.000Z');
}

resetMock();

// --- Helpers -----------------------------------------------------------------------------------

function ownerOf(token) {
  try {
    const part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const sub = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '='))).sub;
    if (sub) return String(sub).toLowerCase();
  } catch {}
  throw new ApiError('Sign in to open your recipe book.', { status: 401 });
}

function bookFor(owner) {
  return books.get(owner) || createBook(owner);
}

const bad = (message) => new ApiError(message, { status: 400 });
const notFound = (what) => new ApiError(`${what} not found`, { status: 404 });
const ownRecipes = (owner) => [...recipes.values()].filter((r) => r.ownerUsername === owner);

function bookDto(book) {
  const mine = ownRecipes(book.ownerUsername);
  return {
    id: book.id,
    title: book.title,
    coverColor: book.coverColor,
    chapters: book.chapters.map((c) => ({
      ...c,
      recipeCount: mine.filter((r) => r.chapterId === c.id).length,
    })),
    recipeCount: mine.length,
    createdAt: book.createdAt,
  };
}

function summaryDto(r) {
  return {
    id: r.id,
    title: r.title,
    chapterId: r.chapterId,
    imageId: r.imageId,
    servings: r.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    ingredientNames: [...r.ingredientNames],
    createdAt: r.createdAt,
  };
}

function recipeDto(r) {
  return {
    ...summaryDto(r),
    ingredients: r.ingredients.map((i) => ({ ...i })),
    instructions: [...r.instructions],
    updatedAt: r.updatedAt,
  };
}

const optionalInt = (value, label, min, max) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} must be a whole number from ${min} to ${max}.`);
  return n;
};

const trimTo = (value, max, label) => {
  const s = String(value ?? '').trim();
  if (s.length > max) throw bad(`${label} can be at most ${max} characters.`);
  return s;
};

/** RecipeRequestDto validation, as the API's @Valid limits plus the service's ownership checks. */
function validateRecipe(owner, body, existing) {
  const title = String(body?.title ?? '').trim();
  if (title.length < 1 || title.length > 120) throw bad('Title must be 1 to 120 characters.');

  const rows = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (rows.length < 1 || rows.length > 100) throw bad('A recipe needs 1 to 100 ingredients.');
  const ingredients = rows.map((row) => {
    const name = trimTo(row?.name, 80, 'An ingredient name');
    if (!name) throw bad('Every ingredient needs a name.');
    return {
      quantity: trimTo(row.quantity, 20, 'A quantity'),
      unit: trimTo(row.unit, 20, 'A unit'),
      name,
      note: trimTo(row.note, 120, 'A note'),
    };
  });

  const steps = Array.isArray(body.instructions) ? body.instructions.map((s) => String(s ?? '').trim()) : [];
  if (steps.length < 1 || steps.length > 50) throw bad('A recipe needs 1 to 50 steps.');
  if (steps.some((s) => !s)) throw bad('Steps cannot be empty.');
  if (steps.some((s) => s.length > 2000)) throw bad('A step can be at most 2000 characters.');

  const book = bookFor(owner);
  const chapterId = body.chapterId || null;
  if (chapterId && !book.chapters.some((c) => c.id === chapterId)) throw bad('That chapter is not in your book.');

  const imageId = body.imageId || null;
  if (imageId) {
    const image = images.get(imageId);
    if (!image || image.ownerUsername !== owner) throw bad('Unknown photo.');
    if (image.recipeId && image.recipeId !== existing?.id) throw bad('That photo belongs to another recipe.');
  }

  return {
    title,
    chapterId,
    servings: optionalInt(body.servings, 'Servings', 1, 100),
    prepMinutes: optionalInt(body.prepMinutes, 'Prep time', 0, 1440),
    cookMinutes: optionalInt(body.cookMinutes, 'Cook time', 0, 1440),
    ingredients,
    instructions: steps,
    imageId,
  };
}

function claimImage(recipe, previousImageId) {
  if (previousImageId && previousImageId !== recipe.imageId) images.delete(previousImageId);
  if (recipe.imageId) {
    const image = images.get(recipe.imageId);
    image.recipeId = recipe.id;
    delete image.expiresAt;
  }
}

function decodeBase64(data) {
  const binary = atob(String(data ?? ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sniff(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  return null;
}

async function measure(blob) {
  try {
    if (typeof createImageBitmap !== 'function') return { width: null, height: null };
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

// --- Routes ------------------------------------------------------------------------------------

const ROUTES = [
  ['GET', /^\/recipe-book$/, (owner) => bookDto(bookFor(owner))],
  [
    'PUT',
    /^\/recipe-book$/,
    (owner, _m, { body }) => {
      const book = bookFor(owner);
      const title = String(body?.title ?? '').trim();
      if (title.length < 1 || title.length > 60) throw bad('The book title must be 1 to 60 characters.');
      const coverColor = body.coverColor || book.coverColor;
      if (!COVER_COLORS.includes(coverColor)) throw bad('Unknown cover colour.');
      const list = Array.isArray(body.chapters) ? body.chapters : [];
      if (list.length > 20) throw bad('A book can have at most 20 chapters.');
      const seen = new Set();
      const chapters = list.map((c) => {
        const name = String(c?.name ?? '').trim();
        if (name.length < 1 || name.length > 40) throw bad('Chapter names must be 1 to 40 characters.');
        const tabColor = String(c.tabColor ?? '').trim();
        if (!TAB_COLOR_PATTERN.test(tabColor)) throw bad('A tab colour must be a lowercase colour name or #rrggbb.');
        // An id the book doesn't have is a new chapter; the same existing id twice is a mistake.
        const known = c.id && book.chapters.some((old) => old.id === c.id);
        if (known && seen.has(c.id)) throw bad('A chapter id appears twice.');
        if (known) seen.add(c.id);
        return { id: known ? c.id : shortId(), name, tabColor };
      });
      const kept = new Set(chapters.map((c) => c.id));
      ownRecipes(owner).forEach((r) => {
        if (r.chapterId && !kept.has(r.chapterId)) r.chapterId = null;
      });
      Object.assign(book, { title, coverColor, chapters, updatedAt: new Date().toISOString() });
      return bookDto(book);
    },
  ],
  [
    'GET',
    /^\/recipes$/,
    (owner, _m, { query }) => {
      const wanted = [query?.ingredient ?? []].flat().map(normalizeIngredient).filter(Boolean);
      const q = String(query?.q ?? '').trim().toLowerCase();
      const chapterId = query?.chapterId || null;
      const items = ownRecipes(owner)
        .filter((r) => wanted.every((term) => r.ingredientTerms.includes(term)))
        .filter((r) => !q || r.title.toLowerCase().includes(q))
        .filter((r) => !chapterId || r.chapterId === chapterId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      // `total` counts every match; `items` is capped at 500.
      return { items: items.slice(0, 500).map(summaryDto), total: items.length };
    },
  ],
  [
    'GET',
    /^\/recipes\/ingredients$/,
    (owner) => {
      const byName = new Map();
      ownRecipes(owner).forEach((r) =>
        r.ingredientNames.forEach((name) => {
          if (!byName.has(name)) byName.set(name, []);
          byName.get(name).push({ id: r.id, title: r.title });
        })
      );
      const entries = [...byName.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, list]) => ({ name, recipes: list.sort((a, b) => a.title.localeCompare(b.title)) }));
      return { entries };
    },
  ],
  [
    'GET',
    /^\/recipes\/([^/]+)$/,
    (owner, [, id]) => {
      const r = recipes.get(decodeURIComponent(id));
      if (!r || r.ownerUsername !== owner) throw notFound('Recipe');
      return recipeDto(r);
    },
  ],
  [
    'POST',
    /^\/recipes$/,
    (owner, _m, { body }) => {
      const fields = validateRecipe(owner, body, null);
      const now = new Date().toISOString();
      const recipe = {
        id: newId('rec'),
        ownerUsername: owner,
        bookId: bookFor(owner).id,
        ...fields,
        ...deriveIngredientFields(fields.ingredients),
        createdAt: now,
        updatedAt: now,
      };
      recipes.set(recipe.id, recipe);
      claimImage(recipe, null);
      return recipeDto(recipe);
    },
  ],
  [
    'PUT',
    /^\/recipes\/([^/]+)$/,
    (owner, [, id], { body }) => {
      const recipe = recipes.get(decodeURIComponent(id));
      if (!recipe || recipe.ownerUsername !== owner) throw notFound('Recipe');
      const previousImageId = recipe.imageId;
      const fields = validateRecipe(owner, body, recipe);
      Object.assign(recipe, fields, deriveIngredientFields(fields.ingredients), {
        updatedAt: new Date().toISOString(),
      });
      claimImage(recipe, previousImageId);
      return recipeDto(recipe);
    },
  ],
  [
    'DELETE',
    /^\/recipes\/([^/]+)$/,
    (owner, [, id]) => {
      const recipe = recipes.get(decodeURIComponent(id));
      if (!recipe || recipe.ownerUsername !== owner) throw notFound('Recipe');
      recipes.delete(recipe.id);
      if (recipe.imageId) images.delete(recipe.imageId);
      return { id: recipe.id, deleted: true };
    },
  ],
  [
    'POST',
    /^\/recipe-images$/,
    async (owner, _m, { body }) => {
      if (!IMAGE_TYPES.includes(body?.mimeType)) throw bad('Only PNG, JPEG and WebP photos can be added.');
      const encoded = String(body.dataBase64 ?? '');
      if (encoded.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4) throw bad('Photos can be at most 2 MB.');
      let bytes;
      try {
        bytes = decodeBase64(encoded);
      } catch {
        throw bad('The photo data is not valid base64.');
      }
      if (bytes.length === 0) throw bad('The photo is empty.');
      if (bytes.length > MAX_IMAGE_BYTES) throw bad('Photos can be at most 2 MB.');
      const sniffed = sniff(bytes);
      if (!sniffed) throw bad('That file is not a PNG, JPEG or WebP image.');
      const blob = new Blob([bytes], { type: sniffed });
      const { width, height } = await measure(blob);
      const now = new Date();
      const image = {
        id: newId('img'),
        ownerUsername: owner,
        recipeId: null,
        mimeType: sniffed,
        sizeBytes: bytes.length,
        width,
        height,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        blob,
      };
      images.set(image.id, image);
      return { id: image.id, mimeType: sniffed, sizeBytes: bytes.length, width, height, createdAt: image.createdAt };
    },
  ],
];

/** Answers one REST call like the API would: resolves with the JSON body or throws an ApiError. */
export async function handleRequest(method, path, { token, body, query } = {}) {
  if (mockConfig.latencyMs) await delay(mockConfig.latencyMs);
  const owner = ownerOf(token);
  for (const [verb, pattern, handler] of ROUTES) {
    // First match wins, so `/recipes/ingredients` (listed first) is never read as a recipe id.
    const match = verb === method && path.match(pattern);
    if (match) return structuredClone(await handler(owner, match, { body, query }));
  }
  throw new ApiError(`No mock for ${method} ${path}`, { status: 404 });
}

/** GET /recipe-images/{id}: the bytes, only for their owner. */
export async function getImageBlob(token, imageId) {
  if (mockConfig.latencyMs) await delay(mockConfig.latencyMs);
  const owner = ownerOf(token);
  const image = images.get(imageId);
  if (!image || image.ownerUsername !== owner) throw notFound('Photo');
  return image.blob;
}

/** Test hook: the stored image document (without bytes), or undefined. */
export function peekImage(imageId) {
  const image = images.get(imageId);
  if (!image) return undefined;
  const meta = { ...image };
  delete meta.blob;
  return meta;
}
