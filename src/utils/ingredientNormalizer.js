/**
 * The recipe book's ingredient folding, the same rules as fitz-net-api's IngredientNormalizer:
 * lowercase, strip punctuation, collapse whitespace, and lightly singularize the last word, so
 * "Eggs" finds "egg" and "Tomatoes" finds "tomato". Used by the mock API and by the index page
 * when it highlights matching ingredients.
 */

// Words the suffix rules would mangle (cookies -> "cooky", leaves -> "leave", molasses -> "molass").
const IRREGULAR = {
  cookies: 'cookie',
  pies: 'pie',
  brownies: 'brownie',
  smoothies: 'smoothie',
  veggies: 'veggie',
  leaves: 'leaf',
  loaves: 'loaf',
  halves: 'half',
  knives: 'knife',
  molasses: 'molasses',
  asparagus: 'asparagus',
  hummus: 'hummus',
  couscous: 'couscous',
  citrus: 'citrus',
  swiss: 'swiss',
  series: 'series',
};

/** berries -> berry, tomatoes -> tomato, dishes -> dish, eggs -> egg; "glass" and short words stay. */
export function singularize(word) {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.length <= 3 || word.endsWith('us')) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (/(s|sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** "  Fresh Eggs! " -> "fresh egg". Apostrophes vanish, other punctuation splits words. */
export function normalizeIngredient(name) {
  const words = String(name ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  words[words.length - 1] = singularize(words[words.length - 1]);
  return words.join(' ');
}

/**
 * The words a name can be found by: the full name plus each word of 3+ letters (singularized).
 * "chicken thigh" -> ["chicken thigh", "chicken", "thigh"].
 */
export function ingredientTerms(name) {
  if (!name) return [];
  const terms = new Set([name]);
  name
    .split(' ')
    .filter((w) => w.length >= 3)
    .forEach((w) => terms.add(singularize(w)));
  return [...terms];
}
