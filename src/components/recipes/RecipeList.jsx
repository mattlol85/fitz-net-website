import React, { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useIngredientIndex, useRecipeList } from '../../hooks/useRecipes';
import { coverStyle } from '../../utils/recipeColors';
import { countLabel } from '../../utils/recipeFormat';
import { PlusIcon } from '../icons';
import EmptyState from './EmptyState';
import RecipeCard from './RecipeCard';
import RecipeSearch from './RecipeSearch';
import { SlidersIcon, SpoonIcon, WhiskIcon } from './doodles';
import '../../css/recipes/RecipeList.css';

const UNSORTED = 'unsorted';

/**
 * The recipe box home (/recipes): the book's banner, the search bar and chapter filters, and a
 * grid of recipe cards. The search lives in the URL (`?q=&ingredient=egg&ingredient=flour&chapter=<id>`)
 * so it can be shared and survives a reload. "Unsorted" has no API filter, so it is applied here.
 */
export default function RecipeList({ bookState, version }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const chapterId = params.get('chapter') || '';
  const ingredients = params.getAll('ingredient');

  const book = bookState.data;
  const apiChapterId = chapterId && chapterId !== UNSORTED ? chapterId : '';
  const { data: list, error, loading, reload } = useRecipeList({ ingredients, q, chapterId: apiChapterId }, version);
  const { data: ingredientIndex } = useIngredientIndex(version);

  const change = useCallback(
    (patch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if ('q' in patch) patch.q ? next.set('q', patch.q) : next.delete('q');
          if ('chapterId' in patch) patch.chapterId ? next.set('chapter', patch.chapterId) : next.delete('chapter');
          if ('ingredients' in patch) {
            next.delete('ingredient');
            patch.ingredients.forEach((name) => next.append('ingredient', name));
          }
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const chapters = book?.chapters || [];
  const chaptersById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const unsortedCount = book ? book.recipeCount - chapters.reduce((sum, c) => sum + c.recipeCount, 0) : 0;

  const items = useMemo(() => {
    const all = list?.items || [];
    return chapterId === UNSORTED ? all.filter((r) => !r.chapterId) : all;
  }, [list, chapterId]);

  const filtered = Boolean(q || ingredients.length || chapterId);
  const clear = () => setParams({}, { replace: true });
  const bookEmpty = book && book.recipeCount === 0 && !filtered;

  return (
    <div className="recipe-list">
      <header className="recipe-banner" style={coverStyle(book?.coverColor)}>
        <WhiskIcon className="recipe-banner__doodle recipe-banner__doodle--whisk" size={64} />
        <SpoonIcon className="recipe-banner__doodle recipe-banner__doodle--spoon" size={56} />
        <div className="recipe-banner__text">
          <h1 className="recipe-banner__title">{book ? book.title : 'Recipe box'}</h1>
          <p className="recipe-banner__count">
            {book ? `${countLabel(book.recipeCount, 'recipe')} · ${countLabel(chapters.length, 'chapter')}` : ' '}
          </p>
        </div>
        <div className="recipe-banner__actions">
          <Link to="/recipes/settings" className="rb-icon-button" aria-label="Book settings" title="Book settings">
            <SlidersIcon size={20} />
          </Link>
          <Link to="/recipes/new" state={{ chapterId: apiChapterId }} className="rb-button rb-button--primary">
            <PlusIcon size={18} /> Add recipe
          </Link>
        </div>
      </header>

      {bookState.error && !book ? (
        <div className="rb-notice" role="alert">
          <p>{bookState.error}</p>
          <button type="button" className="rb-button" onClick={bookState.reload}>
            Try again
          </button>
        </div>
      ) : bookEmpty ? (
        <EmptyState title="Your recipe box is empty" text="Add your first recipe and it will live here, ready to search. 🍓">
          <Link to="/recipes/new" className="rb-button rb-button--primary">
            <PlusIcon size={18} /> Add your first recipe
          </Link>
        </EmptyState>
      ) : (
        <>
          <RecipeSearch
            q={q}
            ingredients={ingredients}
            chapterId={chapterId}
            chapters={chapters}
            total={book?.recipeCount}
            unsortedCount={unsortedCount}
            ingredientIndex={ingredientIndex}
            onChange={change}
          />

          <div className="recipe-list__status" aria-live="polite">
            {!loading && !error && list && (
              <p>
                {countLabel(items.length, 'recipe')}
                {filtered && (
                  <>
                    {' '}
                    found{' '}
                    <button type="button" className="rb-link-button" onClick={clear}>
                      Clear filters
                    </button>
                  </>
                )}
              </p>
            )}
          </div>

          {error && !list ? (
            <div className="rb-notice" role="alert">
              <p>{error}</p>
              <button type="button" className="rb-button" onClick={reload}>
                Try again
              </button>
            </div>
          ) : !list ? (
            <ul className="recipe-grid recipe-grid--loading" aria-busy="true" aria-label="Loading recipes">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="recipe-skeleton" />
              ))}
            </ul>
          ) : items.length === 0 ? (
            <EmptyState variant="search" title="No recipes match" text="Try fewer ingredients or a different word.">
              <button type="button" className="rb-button" onClick={clear}>
                Clear filters
              </button>
            </EmptyState>
          ) : (
            <ul className={`recipe-grid${loading ? ' recipe-grid--refreshing' : ''}`}>
              {items.map((recipe) => (
                <li key={recipe.id}>
                  <RecipeCard recipe={recipe} chapter={chaptersById.get(recipe.chapterId)} searched={ingredients} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
