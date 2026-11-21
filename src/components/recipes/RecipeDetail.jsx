import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRecipe } from '../../hooks/useRecipes';
import { deleteRecipe } from '../../services/recipesApi';
import { formatAdded, formatMinutes, totalMinutes } from '../../utils/recipeFormat';
import { PencilIcon, TrashIcon } from '../icons';
import ChapterPill from './ChapterPill';
import ConfirmDialog from './ConfirmDialog';
import RecipePhoto from './RecipePhoto';
import { ArrowLeftIcon, ClockIcon, HeartIcon, PeopleIcon, SpoonIcon, WhiskIcon } from './doodles';
import '../../css/recipes/RecipeDetail.css';

function Fact({ icon, label, value }) {
  if (!value) return null;
  return (
    <li className="recipe-chip recipe-chip--lg">
      {icon}
      <span>
        <span className="recipe-chip__label">{label}</span> {value}
      </span>
    </li>
  );
}

/** A recipe's ingredient line: "2 cups all-purpose flour, sifted". */
function IngredientLine({ row }) {
  const amount = [row.quantity, row.unit].filter(Boolean).join(' ');
  return (
    <>
      {amount && <span className="ingredient__amount">{amount}</span>} <span className="ingredient__name">{row.name}</span>
      {row.note && <span className="ingredient__note">, {row.note}</span>}
    </>
  );
}

/**
 * /recipes/:id. The photo, title and facts; ingredients as a checklist to tick while cooking
 * (kept for this visit only); the numbered method; Edit and Delete (which asks first).
 * One column on a phone, ingredients beside the steps on a wide screen.
 */
export default function RecipeDetail({ book, version, onChanged }) {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, error, loading, reload } = useRecipe(id, version);
  // The hook keeps the previous recipe while the next one loads; never show it under another id.
  const recipe = data?.id === id ? data : null;
  const [ticked, setTicked] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const chapter = recipe && book?.chapters.find((c) => c.id === recipe.chapterId);

  const toggle = (index) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteRecipe(token, id);
      onChanged();
      navigate('/recipes', { replace: true });
    } catch (err) {
      setDeleting(false);
      setDeleteError(err.message || 'The recipe could not be deleted.');
    }
  };

  const back = (
    <Link to="/recipes" className="recipe-back">
      <ArrowLeftIcon size={18} /> Recipe box
    </Link>
  );

  if (!recipe) {
    return (
      <div className="recipe-detail">
        {back}
        {error ? (
          <div className="rb-notice" role="alert">
            <p>{error}</p>
            <button type="button" className="rb-button" onClick={reload}>
              Try again
            </button>
          </div>
        ) : (
          loading && <p className="rb-loading" role="status">Opening the recipe…</p>
        )}
      </div>
    );
  }

  const total = totalMinutes(recipe);
  const added = formatAdded(recipe.createdAt);
  const tickedCount = ticked.size;

  return (
    <div className="recipe-detail">
      <div className="recipe-detail__bar">
        {back}
        <div className="recipe-detail__actions">
          <Link to={`/recipes/${encodeURIComponent(recipe.id)}/edit`} className="rb-button">
            <PencilIcon size={16} /> Edit
          </Link>
          <button type="button" className="rb-button rb-button--danger-outline" onClick={() => setConfirming(true)}>
            <TrashIcon size={16} /> Delete
          </button>
        </div>
      </div>

      <article className="recipe-detail__card">
        <header className="recipe-detail__hero">
          <RecipePhoto imageId={recipe.imageId} tabColor={chapter?.tabColor} alt={`Photo of ${recipe.title}`} size="hero" tilt />
          <div className="recipe-detail__heading">
            <div className="recipe-detail__badges">
              {chapter ? <ChapterPill name={chapter.name} tabColor={chapter.tabColor} /> : <ChapterPill name="Unsorted" tabColor="paper" />}
              {added && (
                <span className="added-badge">
                  <HeartIcon size={14} filled /> Added {added}
                </span>
              )}
              {location.state?.saved && (
                <span className="saved-flash" role="status">
                  Saved!
                </span>
              )}
            </div>
            <h1 className="recipe-detail__title">{recipe.title}</h1>
            <ul className="recipe-detail__facts" aria-label="Quick facts">
              <Fact
                icon={<PeopleIcon size={18} />}
                label="Serves"
                value={recipe.servings ? String(recipe.servings) : ''}
              />
              <Fact icon={<WhiskIcon size={18} />} label="Prep" value={formatMinutes(recipe.prepMinutes)} />
              <Fact icon={<SpoonIcon size={18} />} label="Cook" value={formatMinutes(recipe.cookMinutes)} />
              {total && recipe.prepMinutes && recipe.cookMinutes ? (
                <Fact icon={<ClockIcon size={18} />} label="Total" value={formatMinutes(total)} />
              ) : null}
            </ul>
          </div>
        </header>

        <div className="recipe-detail__body">
          <section className="recipe-detail__ingredients" aria-labelledby="ingredients-heading">
            <h2 id="ingredients-heading">Ingredients</h2>
            <p className="recipe-detail__progress" aria-live="polite">
              {tickedCount === 0 ? 'Tick things off as you cook.' : `${tickedCount} of ${recipe.ingredients.length} ready`}
            </p>
            <ul className="ingredient-list">
              {recipe.ingredients.map((row, index) => (
                <li key={`${index}-${row.name}`}>
                  <label className={`ingredient${ticked.has(index) ? ' ingredient--done' : ''}`}>
                    <input type="checkbox" checked={ticked.has(index)} onChange={() => toggle(index)} />
                    <span className="ingredient__box" aria-hidden="true" />
                    <span className="ingredient__text">
                      <IngredientLine row={row} />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="recipe-detail__steps" aria-labelledby="steps-heading">
            <h2 id="steps-heading">Method</h2>
            <ol className="step-list">
              {recipe.instructions.map((text, index) => (
                <li key={`${index}-${text.slice(0, 12)}`} className="step">
                  <span className="step__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </article>

      {confirming && (
        <ConfirmDialog
          title={`Delete “${recipe.title}”?`}
          message="This removes the recipe and its photo from your box for good."
          busy={deleting}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => {
            setConfirming(false);
            setDeleteError('');
          }}
        />
      )}
    </div>
  );
}
