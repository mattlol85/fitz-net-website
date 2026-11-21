/**
 * The recipe form's state and validation, kept pure so it is easy to test. The limits mirror
 * fitz-net-api's RecipeRequestDto so problems show inline before the request is sent.
 */
export const LIMITS = {
  title: 120,
  ingredientName: 80,
  quantity: 20,
  unit: 20,
  note: 120,
  step: 2000,
  maxIngredients: 100,
  maxSteps: 50,
  servings: [1, 100],
  minutes: [0, 1440],
};

let nextKey = 1;
const newKey = () => `row-${nextKey++}`;

export const blankIngredient = () => ({ key: newKey(), quantity: '', unit: '', name: '', note: '' });
export const blankStep = () => ({ key: newKey(), text: '' });

const str = (value) => (value === null || value === undefined ? '' : String(value));

/** The form values for a new recipe (in `chapterId`) or an existing RecipeDto. */
export function toForm(recipe, chapterId = '') {
  if (!recipe) {
    return {
      title: '',
      chapterId,
      servings: '',
      prepMinutes: '',
      cookMinutes: '',
      ingredients: [blankIngredient(), blankIngredient(), blankIngredient()],
      steps: [blankStep(), blankStep()],
      imageId: null,
    };
  }
  return {
    title: recipe.title,
    chapterId: recipe.chapterId || '',
    servings: str(recipe.servings),
    prepMinutes: str(recipe.prepMinutes),
    cookMinutes: str(recipe.cookMinutes),
    ingredients: recipe.ingredients.map((row) => ({
      key: newKey(),
      quantity: str(row.quantity),
      unit: str(row.unit),
      name: str(row.name),
      note: str(row.note),
    })),
    steps: recipe.instructions.map((text) => ({ key: newKey(), text })),
    imageId: recipe.imageId || null,
  };
}

const optionalNumber = (value) => {
  const s = String(value).trim();
  return s === '' ? null : Number(s);
};

function checkNumber(value, [min, max], label) {
  const n = optionalNumber(value);
  if (n === null) return '';
  return Number.isInteger(n) && n >= min && n <= max ? '' : `${label} should be a whole number from ${min} to ${max}.`;
}

/**
 * `{ body, errors }`: the RecipeRequestDto to send, and the problems that stop it being sent
 * (`errors` is empty when the form is fine). Blank ingredient and step rows are ignored; problems
 * on a particular row are keyed by that row's `key` in `errors.rows`.
 */
export function toRequest(form) {
  const ingredients = form.ingredients
    .map((row) => ({
      key: row.key,
      quantity: row.quantity.trim(),
      unit: row.unit.trim(),
      name: row.name.trim(),
      note: row.note.trim(),
    }))
    .filter((row) => row.quantity || row.unit || row.name || row.note);
  const steps = form.steps.map((s) => ({ key: s.key, text: s.text.trim() })).filter((s) => s.text);

  const errors = {};
  const rows = {};
  const title = form.title.trim();
  if (!title) errors.title = 'Give the recipe a name.';
  else if (title.length > LIMITS.title) errors.title = `Keep the name under ${LIMITS.title} characters.`;

  if (ingredients.length === 0) errors.ingredients = 'Add at least one ingredient.';
  else if (ingredients.length > LIMITS.maxIngredients) errors.ingredients = `A recipe can have up to ${LIMITS.maxIngredients} ingredients.`;
  ingredients.forEach((row) => {
    if (!row.name) rows[row.key] = 'This ingredient needs a name.';
    else if (row.name.length > LIMITS.ingredientName) rows[row.key] = `The name can be up to ${LIMITS.ingredientName} characters.`;
    else if (row.quantity.length > LIMITS.quantity) rows[row.key] = `The quantity can be up to ${LIMITS.quantity} characters.`;
    else if (row.unit.length > LIMITS.unit) rows[row.key] = `The unit can be up to ${LIMITS.unit} characters.`;
    else if (row.note.length > LIMITS.note) rows[row.key] = `The note can be up to ${LIMITS.note} characters.`;
  });

  if (steps.length === 0) errors.instructions = 'Write at least one step.';
  else if (steps.length > LIMITS.maxSteps) errors.instructions = `A recipe can have up to ${LIMITS.maxSteps} steps.`;
  steps.forEach((s) => {
    if (s.text.length > LIMITS.step) rows[s.key] = `A step can be up to ${LIMITS.step} characters.`;
  });

  const servings = checkNumber(form.servings, LIMITS.servings, 'Servings');
  const prep = checkNumber(form.prepMinutes, LIMITS.minutes, 'Prep time');
  const cook = checkNumber(form.cookMinutes, LIMITS.minutes, 'Cook time');
  if (servings) errors.servings = servings;
  if (prep) errors.prepMinutes = prep;
  if (cook) errors.cookMinutes = cook;
  if (Object.keys(rows).length) errors.rows = rows;

  return {
    errors,
    body: {
      title,
      chapterId: form.chapterId || null,
      servings: optionalNumber(form.servings),
      prepMinutes: optionalNumber(form.prepMinutes),
      cookMinutes: optionalNumber(form.cookMinutes),
      ingredients: ingredients.map(({ quantity, unit, name, note }) => ({ quantity, unit, name, note })),
      instructions: steps.map((s) => s.text),
      imageId: form.imageId || null,
    },
  };
}
