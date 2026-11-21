import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRecipe } from '../../hooks/useRecipes';
import { createRecipe, updateRecipe, uploadRecipePhoto } from '../../services/recipesApi';
import { CloseIcon, PlusIcon } from '../icons';
import ChapterPill from './ChapterPill';
import PhotoPicker from './PhotoPicker';
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from './doodles';
import { LIMITS, blankIngredient, blankStep, toForm, toRequest } from './recipeFormModel';
import '../../css/recipes/RecipeForm.css';

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="form-error" role="alert">
      {message}
    </p>
  );
}

/** A textarea that grows with what is typed in it. */
function AutoTextarea({ value, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} {...rest} />;
}

/** Up, down and remove buttons for one row of a list. */
function RowTools({ label, index, count, onMove, onRemove }) {
  return (
    <div className="row-tools">
      <button type="button" className="rb-icon-button rb-icon-button--small" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index, -1)}>
        <ChevronUpIcon size={16} />
      </button>
      <button
        type="button"
        className="rb-icon-button rb-icon-button--small"
        aria-label={`Move ${label} down`}
        disabled={index === count - 1}
        onClick={() => onMove(index, 1)}
      >
        <ChevronDownIcon size={16} />
      </button>
      <button type="button" className="rb-icon-button rb-icon-button--small rb-icon-button--danger" aria-label={`Remove ${label}`} onClick={() => onRemove(index)}>
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

const moveItem = (list, index, delta) => {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
};

/**
 * /recipes/new and /recipes/:id/edit: one practical form. Title, chapter pills, servings and
 * times, structured ingredient rows (quantity, unit, name, note; Enter adds a row), numbered
 * steps, one optional photo, and inline validation that mirrors the API's limits.
 */
export default function RecipeForm({ book, version, onChanged }) {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: existing, error: loadError, loading, reload } = useRecipe(id, version);
  const [form, setForm] = useState(() => toForm(null, location.state?.chapterId || ''));
  const [ready, setReady] = useState(!id);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [photo, setPhoto] = useState({ previewUrl: null, uploading: false, error: '' });
  const previewRef = useRef(null);
  const focusAfter = useRef(null);
  const ids = useId();
  const chapters = book?.chapters || [];

  useEffect(() => {
    if (id && existing?.id === id && !ready) {
      setForm(toForm(existing));
      setReady(true);
    }
  }, [id, existing, ready]);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

  // Move focus into a row that was just added.
  useEffect(() => {
    if (!focusAfter.current) return;
    document.querySelector(`[data-row="${focusAfter.current.key}"] [data-field="${focusAfter.current.field}"]`)?.focus();
    focusAfter.current = null;
  });

  const set = useCallback((changes) => setForm((prev) => ({ ...prev, ...changes })), []);
  const clearError = (name) => setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));

  const pickPhoto = useCallback(
    async (file) => {
      setPhoto((p) => ({ ...p, uploading: true, error: '' }));
      try {
        const { image, preview } = await uploadRecipePhoto(token, file);
        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        previewRef.current = URL.createObjectURL(preview);
        setPhoto({ previewUrl: previewRef.current, uploading: false, error: '' });
        set({ imageId: image.id });
      } catch (err) {
        setPhoto((p) => ({ ...p, uploading: false, error: err.message || 'That photo could not be added.' }));
      }
    },
    [token, set]
  );

  const removePhoto = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPhoto({ previewUrl: null, uploading: false, error: '' });
    set({ imageId: null });
  };

  // --- Ingredient rows ---
  const changeIngredient = (key, field, value) =>
    setForm((prev) => ({ ...prev, ingredients: prev.ingredients.map((r) => (r.key === key ? { ...r, [field]: value } : r)) }));
  const addIngredientAfter = (index) => {
    const row = blankIngredient();
    focusAfter.current = { key: row.key, field: 'quantity' };
    setForm((prev) => {
      if (prev.ingredients.length >= LIMITS.maxIngredients) return prev;
      const rows = [...prev.ingredients];
      rows.splice(index + 1, 0, row);
      return { ...prev, ingredients: rows };
    });
  };
  const removeIngredient = (index) =>
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.length > 1 ? prev.ingredients.filter((_, i) => i !== index) : [blankIngredient()],
    }));

  // --- Steps ---
  const changeStep = (key, text) => setForm((prev) => ({ ...prev, steps: prev.steps.map((s) => (s.key === key ? { ...s, text } : s)) }));
  const addStep = () => {
    const step = blankStep();
    focusAfter.current = { key: step.key, field: 'text' };
    setForm((prev) => (prev.steps.length >= LIMITS.maxSteps ? prev : { ...prev, steps: [...prev.steps, step] }));
  };
  const removeStep = (index) =>
    setForm((prev) => ({ ...prev, steps: prev.steps.length > 1 ? prev.steps.filter((_, i) => i !== index) : [blankStep()] }));

  const submit = async (event) => {
    event.preventDefault();
    if (saving || photo.uploading) return;
    const { errors: problems, body } = toRequest(form);
    setErrors(problems);
    if (Object.keys(problems).length) {
      setSaveError('');
      // Take the person to the first thing that needs fixing.
      requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const saved = id ? await updateRecipe(token, id, body) : await createRecipe(token, body);
      onChanged();
      navigate(`/recipes/${encodeURIComponent(saved.id)}`, { replace: true, state: { saved: true } });
    } catch (err) {
      setSaving(false);
      setSaveError(err.message || 'The recipe could not be saved.');
    }
  };

  const cancelTo = id ? `/recipes/${encodeURIComponent(id)}` : '/recipes';
  const heading = id ? 'Edit recipe' : 'New recipe';

  if (id && !ready) {
    return (
      <div className="recipe-form">
        <Link to={cancelTo} className="recipe-back">
          <ArrowLeftIcon size={18} /> Back
        </Link>
        {loadError ? (
          <div className="rb-notice" role="alert">
            <p>{loadError}</p>
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

  const tabColor = chapters.find((c) => c.id === form.chapterId)?.tabColor;

  return (
    <div className="recipe-form">
      <Link to={cancelTo} className="recipe-back">
        <ArrowLeftIcon size={18} /> {id ? 'Back to recipe' : 'Recipe box'}
      </Link>
      <form className="form-card" onSubmit={submit} noValidate aria-labelledby={`${ids}-heading`}>
        <h1 id={`${ids}-heading`} className="form-card__title">
          {heading}
        </h1>

        <div className="form-card__top">
          <div className="form-card__main">
            <div className="field">
              <label htmlFor={`${ids}-title`}>Recipe name</label>
              <input
                id={`${ids}-title`}
                value={form.title}
                maxLength={LIMITS.title}
                placeholder="Sunday pancakes"
                aria-invalid={errors.title ? 'true' : undefined}
                aria-describedby={errors.title ? `${ids}-title-error` : undefined}
                onChange={(e) => {
                  set({ title: e.target.value });
                  clearError('title');
                }}
              />
              <FieldError id={`${ids}-title-error`} message={errors.title} />
            </div>

            <fieldset className="field chapter-field">
              <legend>Chapter</legend>
              <div className="chapter-field__pills">
                {chapters.map((c) => (
                  <ChapterPill key={c.id} name={c.name} tabColor={c.tabColor} active={form.chapterId === c.id} onClick={() => set({ chapterId: c.id })} />
                ))}
                <ChapterPill name="Unsorted" tabColor="paper" active={!form.chapterId} onClick={() => set({ chapterId: '' })} />
              </div>
            </fieldset>

            <div className="form-card__numbers">
              {[
                ['servings', 'Servings', 'serves', LIMITS.servings],
                ['prepMinutes', 'Prep (min)', 'prep', LIMITS.minutes],
                ['cookMinutes', 'Cook (min)', 'cook', LIMITS.minutes],
              ].map(([field, label, key, [min, max]]) => (
                <div className="field" key={field}>
                  <label htmlFor={`${ids}-${key}`}>{label}</label>
                  <input
                    id={`${ids}-${key}`}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    value={form[field]}
                    aria-invalid={errors[field] ? 'true' : undefined}
                    aria-describedby={errors[field] ? `${ids}-${key}-error` : undefined}
                    onChange={(e) => {
                      set({ [field]: e.target.value });
                      clearError(field);
                    }}
                  />
                </div>
              ))}
              {['servings', 'prepMinutes', 'cookMinutes'].map((field, i) => (
                <FieldError key={field} id={`${ids}-${['serves', 'prep', 'cook'][i]}-error`} message={errors[field]} />
              ))}
            </div>
          </div>

          <div className="form-card__photo">
            <span className="field-label">
              Photo <span className="field-label__hint">(optional)</span>
            </span>
            <PhotoPicker
              imageId={form.imageId}
              previewUrl={photo.previewUrl}
              tabColor={tabColor}
              uploading={photo.uploading}
              error={photo.error}
              onPick={pickPhoto}
              onRemove={removePhoto}
            />
          </div>
        </div>

        <section className="form-section" aria-labelledby={`${ids}-ingredients`}>
          <h2 id={`${ids}-ingredients`}>Ingredients</h2>
          <div className="ingredient-grid-head" aria-hidden="true">
            <span>Qty</span>
            <span>Unit</span>
            <span>Ingredient</span>
            <span>Note</span>
          </div>
          <ul className="row-list">
            {form.ingredients.map((row, index) => {
              const n = index + 1;
              const rowError = errors.rows?.[row.key];
              const onKey = (event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addIngredientAfter(index);
                }
              };
              const field = (name, label, max, extra = {}) => (
                <input
                  data-field={name}
                  aria-label={`Ingredient ${n} ${label}`}
                  value={row[name]}
                  maxLength={max}
                  autoComplete="off"
                  onKeyDown={onKey}
                  onChange={(e) => {
                    changeIngredient(row.key, name, e.target.value);
                    clearError('rows');
                    clearError('ingredients');
                  }}
                  {...extra}
                />
              );
              return (
                <li key={row.key} data-row={row.key} className="ingredient-row">
                  <div className="ingredient-row__fields">
                    {field('quantity', 'quantity', LIMITS.quantity, { placeholder: '1 1/2', className: 'is-qty' })}
                    {field('unit', 'unit', LIMITS.unit, { placeholder: 'cups', className: 'is-unit' })}
                    {field('name', 'name', LIMITS.ingredientName, {
                      placeholder: 'flour',
                      className: 'is-name',
                      'aria-invalid': rowError ? 'true' : undefined,
                      'aria-describedby': rowError ? `${ids}-${row.key}-error` : undefined,
                    })}
                    {field('note', 'note', LIMITS.note, { placeholder: 'sifted', className: 'is-note' })}
                  </div>
                  <RowTools
                    label={`ingredient ${n}`}
                    index={index}
                    count={form.ingredients.length}
                    onMove={(i, d) => setForm((prev) => ({ ...prev, ingredients: moveItem(prev.ingredients, i, d) }))}
                    onRemove={removeIngredient}
                  />
                  <FieldError id={`${ids}-${row.key}-error`} message={rowError} />
                </li>
              );
            })}
          </ul>
          <FieldError id={`${ids}-ingredients-error`} message={errors.ingredients} />
          <button type="button" className="rb-button rb-button--dashed" onClick={() => addIngredientAfter(form.ingredients.length - 1)} disabled={form.ingredients.length >= LIMITS.maxIngredients}>
            <PlusIcon size={16} /> Add ingredient
          </button>
        </section>

        <section className="form-section" aria-labelledby={`${ids}-steps`}>
          <h2 id={`${ids}-steps`}>Method</h2>
          <ol className="row-list step-rows">
            {form.steps.map((step, index) => {
              const rowError = errors.rows?.[step.key];
              return (
                <li key={step.key} data-row={step.key} className="step-row">
                  <span className="step-row__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <AutoTextarea
                    data-field="text"
                    aria-label={`Step ${index + 1}`}
                    value={step.text}
                    maxLength={LIMITS.step}
                    placeholder={index === 0 ? 'Whisk the dry ingredients together…' : 'Next, …'}
                    aria-invalid={rowError ? 'true' : undefined}
                    aria-describedby={rowError ? `${ids}-${step.key}-error` : undefined}
                    onChange={(e) => {
                      changeStep(step.key, e.target.value);
                      clearError('rows');
                      clearError('instructions');
                    }}
                  />
                  <RowTools
                    label={`step ${index + 1}`}
                    index={index}
                    count={form.steps.length}
                    onMove={(i, d) => setForm((prev) => ({ ...prev, steps: moveItem(prev.steps, i, d) }))}
                    onRemove={removeStep}
                  />
                  <FieldError id={`${ids}-${step.key}-error`} message={rowError} />
                </li>
              );
            })}
          </ol>
          <FieldError id={`${ids}-instructions-error`} message={errors.instructions} />
          <button type="button" className="rb-button rb-button--dashed" onClick={addStep} disabled={form.steps.length >= LIMITS.maxSteps}>
            <PlusIcon size={16} /> Add step
          </button>
        </section>

        <footer className="form-card__footer">
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          {Object.keys(errors).some((k) => errors[k]) && (
            <p className="form-error" role="alert">
              A few things need a look before this can be saved.
            </p>
          )}
          <div className="form-card__buttons">
            <Link to={cancelTo} className="rb-button">
              Cancel
            </Link>
            <button type="submit" className={`rb-button rb-button--primary rb-button--save${saving ? ' is-saving' : ''}`} disabled={saving || photo.uploading}>
              {saving ? 'Saving…' : id ? 'Save changes' : 'Save recipe'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
