/** Small display helpers for recipes. */

/** 75 -> "1 h 15 min", 45 -> "45 min", 0 or missing -> "". */
export function formatMinutes(minutes) {
  if (!minutes || minutes < 1) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Prep plus cook, or null when neither is set. */
export function totalMinutes(recipe) {
  const total = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
  return total > 0 ? total : null;
}

/** "2026-11-20T09:30:00.000Z" -> "Nov 20, 2026" (empty for a missing or bad date). */
export function formatAdded(iso) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** 1 -> "1 recipe", 3 -> "3 recipes". */
export const countLabel = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
