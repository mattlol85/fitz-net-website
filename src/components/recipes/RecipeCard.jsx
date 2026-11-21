import React from 'react';
import { Link } from 'react-router-dom';
import { formatAdded, formatMinutes, totalMinutes } from '../../utils/recipeFormat';
import { ingredientTerms, normalizeIngredient } from '../../utils/ingredientNormalizer';
import ChapterPill from './ChapterPill';
import RecipePhoto from './RecipePhoto';
import { ClockIcon, PeopleIcon } from './doodles';
import '../../css/recipes/RecipeCard.css';

/** The recipe's ingredient names that satisfy one of the searched-for ingredients. */
export function matchedIngredients(recipe, searched) {
  if (!searched?.length) return [];
  const wanted = searched.map(normalizeIngredient).filter(Boolean);
  return (recipe.ingredientNames || []).filter((name) => {
    const terms = ingredientTerms(name);
    return wanted.some((w) => terms.includes(w));
  });
}

/**
 * One recipe in the grid: photo, title (the card's link), chapter pill, servings and total time
 * chips, and the date it was added. While ingredient chips are active it lists the matching
 * ingredients, highlighted.
 */
export default function RecipeCard({ recipe, chapter, searched }) {
  const total = totalMinutes(recipe);
  const matches = matchedIngredients(recipe, searched);
  const added = formatAdded(recipe.createdAt);
  return (
    <article className="recipe-card">
      <RecipePhoto imageId={recipe.imageId} tabColor={chapter?.tabColor} size="card" />
      <div className="recipe-card__body">
        <div className="recipe-card__meta">
          {chapter ? <ChapterPill name={chapter.name} tabColor={chapter.tabColor} size="sm" /> : <ChapterPill name="Unsorted" tabColor="paper" size="sm" />}
        </div>
        <h3 className="recipe-card__title">
          <Link to={`/recipes/${encodeURIComponent(recipe.id)}`} className="recipe-card__link">
            {recipe.title}
          </Link>
        </h3>
        {(recipe.servings || total) && (
          <ul className="recipe-card__chips" aria-label="Quick facts">
            {recipe.servings ? (
              <li className="recipe-chip">
                <PeopleIcon size={14} />
                <span>
                  {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
                </span>
              </li>
            ) : null}
            {total ? (
              <li className="recipe-chip">
                <ClockIcon size={14} />
                <span>
                  <span className="rb-visually-hidden">Total time </span>
                  {formatMinutes(total)}
                </span>
              </li>
            ) : null}
          </ul>
        )}
        {matches.length > 0 && (
          <p className="recipe-card__matches">
            <span className="recipe-card__matches-label">Has </span>
            {matches.map((name, i) => (
              <React.Fragment key={name}>
                {i > 0 && ', '}
                <mark className="recipe-card__match">{name}</mark>
              </React.Fragment>
            ))}
          </p>
        )}
        {added && <p className="recipe-card__added">Added {added}</p>}
      </div>
    </article>
  );
}
