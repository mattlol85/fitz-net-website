import React, { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { updateRecipeBook } from '../../services/recipesApi';
import { COVER_COLORS, COVER_LABELS, TAB_COLORS, chapterStyle, coverStyle } from '../../utils/recipeColors';
import { countLabel } from '../../utils/recipeFormat';
import { CloseIcon, PlusIcon } from '../icons';
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from './doodles';
import '../../css/recipes/RecipeSettings.css';

const MAX_CHAPTERS = 20;
let nextKey = 1;
const newKey = () => `chapter-${nextKey++}`;

function ColorPicker({ chapter, onPick }) {
  const group = useId();
  // A chapter saved with a hex or an unusual name keeps that colour as one more choice.
  const options = TAB_COLORS.includes(chapter.tabColor) ? TAB_COLORS : [chapter.tabColor, ...TAB_COLORS];
  return (
    <fieldset className="color-picker">
      <legend className="rb-visually-hidden">Colour for {chapter.name || 'this chapter'}</legend>
      {options.map((color) => (
        <label key={color} className="color-picker__swatch" style={chapterStyle(color)} title={color}>
          <input type="radio" name={group} value={color} checked={chapter.tabColor === color} onChange={() => onPick(color)} />
          <span className="rb-visually-hidden">{color}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * /recipes/settings: rename the book, pick its cover colour (it tints the banner), and manage
 * chapters (add, rename, reorder, recolour, delete). One PUT /recipe-book saves it all; recipes in
 * a deleted chapter move to Unsorted.
 */
export default function RecipeSettings({ book, onChanged }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState(book.title);
  const [coverColor, setCoverColor] = useState(book.coverColor || 'rose');
  const [chapters, setChapters] = useState(() =>
    book.chapters.map((c) => ({ key: newKey(), id: c.id, name: c.name, tabColor: c.tabColor, recipeCount: c.recipeCount || 0 }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ids = useId();
  const coverGroup = useId();

  const change = (key, changes) => setChapters((list) => list.map((c) => (c.key === key ? { ...c, ...changes } : c)));
  const move = (from, delta) =>
    setChapters((list) => {
      const to = from + delta;
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  const add = () =>
    setChapters((list) =>
      list.length >= MAX_CHAPTERS ? list : [...list, { key: newKey(), id: null, name: '', tabColor: TAB_COLORS[list.length % TAB_COLORS.length], recipeCount: 0 }]
    );

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!title.trim()) return setError('The book needs a title.');
    if (chapters.some((c) => !c.name.trim())) return setError('Every chapter needs a name.');
    setSaving(true);
    setError('');
    try {
      await updateRecipeBook(token, {
        title: title.trim(),
        coverColor,
        chapters: chapters.map((c) => ({ ...(c.id ? { id: c.id } : {}), name: c.name.trim(), tabColor: c.tabColor })),
      });
      onChanged();
      navigate('/recipes');
    } catch (err) {
      setSaving(false);
      setError(err.message || 'The settings could not be saved.');
    }
  };

  return (
    <div className="recipe-settings">
      <Link to="/recipes" className="recipe-back">
        <ArrowLeftIcon size={18} /> Recipe box
      </Link>
      <form className="settings-card" onSubmit={submit} noValidate aria-labelledby={`${ids}-heading`}>
        <h1 id={`${ids}-heading`} className="settings-card__title">
          Book settings
        </h1>

        <section className="settings-section" aria-labelledby={`${ids}-book`}>
          <h2 id={`${ids}-book`}>Your book</h2>
          <div className="field">
            <label htmlFor={`${ids}-title`}>Book name</label>
            <input id={`${ids}-title`} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <fieldset className="cover-picker">
            <legend>Cover colour</legend>
            <div className="cover-picker__swatches">
              {COVER_COLORS.map((color) => (
                <label key={color} className="cover-swatch" style={coverStyle(color)}>
                  <input type="radio" name={coverGroup} value={color} checked={coverColor === color} onChange={() => setCoverColor(color)} />
                  <span className="cover-swatch__chip" aria-hidden="true" />
                  <span className="cover-swatch__name">{COVER_LABELS[color]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="settings-section" aria-labelledby={`${ids}-chapters`}>
          <h2 id={`${ids}-chapters`}>Chapters</h2>
          <ul className="chapter-rows">
            {chapters.map((c, i) => (
              <li key={c.key} className="chapter-row" style={chapterStyle(c.tabColor)}>
                <span className="chapter-row__dot" aria-hidden="true" />
                <div className="chapter-row__main">
                  <input
                    className="chapter-row__name"
                    value={c.name}
                    maxLength={40}
                    aria-label={`Chapter ${i + 1} name`}
                    placeholder="New chapter"
                    onChange={(e) => change(c.key, { name: e.target.value })}
                  />
                  <ColorPicker chapter={c} onPick={(tabColor) => change(c.key, { tabColor })} />
                  {c.recipeCount > 0 && <span className="chapter-row__count">{countLabel(c.recipeCount, 'recipe')}</span>}
                </div>
                <div className="row-tools">
                  <button type="button" className="rb-icon-button rb-icon-button--small" aria-label={`Move ${c.name || 'chapter'} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ChevronUpIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className="rb-icon-button rb-icon-button--small"
                    aria-label={`Move ${c.name || 'chapter'} down`}
                    disabled={i === chapters.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDownIcon size={16} />
                  </button>
                  <button
                    type="button"
                    className="rb-icon-button rb-icon-button--small rb-icon-button--danger"
                    aria-label={`Delete ${c.name || 'chapter'}`}
                    title={c.recipeCount ? 'Its recipes move to Unsorted' : 'Delete chapter'}
                    onClick={() => setChapters((list) => list.filter((x) => x.key !== c.key))}
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className="rb-button rb-button--dashed" onClick={add} disabled={chapters.length >= MAX_CHAPTERS}>
            <PlusIcon size={16} /> Add chapter
          </button>
          <p className="settings-note">Deleting a chapter keeps its recipes; they move to Unsorted.</p>
        </section>

        <footer className="settings-card__footer">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="settings-card__buttons">
            <Link to="/recipes" className="rb-button">
              Cancel
            </Link>
            <button type="submit" className={`rb-button rb-button--primary rb-button--save${saving ? ' is-saving' : ''}`} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
