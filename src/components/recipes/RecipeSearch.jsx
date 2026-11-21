import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CloseIcon, SearchIcon } from '../icons';
import { normalizeIngredient } from '../../utils/ingredientNormalizer';
import { countLabel } from '../../utils/recipeFormat';
import ChapterPill from './ChapterPill';
import '../../css/recipes/RecipeSearch.css';

const SUGGESTION_LIMIT = 8;
const DEBOUNCE_MS = 250;

/** Whole-book search: title text, ingredient chips with autocomplete, and chapter filter pills. */
export default function RecipeSearch({
  q,
  ingredients,
  chapterId,
  chapters,
  total,
  unsortedCount,
  ingredientIndex,
  onChange,
}) {
  const [text, setText] = useState(q);
  const lastSent = useRef(q);
  const timer = useRef(null);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const listId = useId();
  const textId = useId();
  const ingredientId = useId();

  // The URL can change under us (Clear filters, back button): follow it, unless it is just our own echo.
  useEffect(() => {
    if (q !== lastSent.current) {
      lastSent.current = q;
      setText(q);
    }
  }, [q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onText = (value) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastSent.current = value.trim();
      onChange({ q: value.trim() });
    }, DEBOUNCE_MS);
  };

  const chosen = useMemo(() => new Set(ingredients.map(normalizeIngredient)), [ingredients]);
  const suggestions = useMemo(() => {
    const needle = normalizeIngredient(draft);
    if (!needle) return [];
    const matches = (ingredientIndex?.entries || []).filter((e) => !chosen.has(e.name) && e.name.includes(needle));
    matches.sort((a, b) => Number(b.name.startsWith(needle)) - Number(a.name.startsWith(needle)));
    return matches.slice(0, SUGGESTION_LIMIT);
  }, [draft, ingredientIndex, chosen]);

  const showList = open && suggestions.length > 0;

  const add = (name) => {
    const clean = name.trim().toLowerCase();
    if (!clean || chosen.has(normalizeIngredient(clean))) {
      setDraft('');
      return;
    }
    onChange({ ingredients: [...ingredients, clean] });
    setDraft('');
    setHighlight(-1);
    setOpen(false);
  };

  const remove = (name) => onChange({ ingredients: ingredients.filter((i) => i !== name) });

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => (suggestions.length ? (h + 1) % suggestions.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => (suggestions.length ? (h <= 0 ? suggestions.length - 1 : h - 1) : -1));
    } else if (event.key === 'Enter' || event.key === ',') {
      if (!draft.trim()) return;
      event.preventDefault();
      // Enter takes the suggestion you arrowed to, otherwise exactly what you typed.
      add(showList && highlight >= 0 ? suggestions[highlight].name : draft);
    } else if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'Backspace' && !draft && ingredients.length) {
      remove(ingredients[ingredients.length - 1]);
    }
  };

  const pick = (id) => onChange({ chapterId: id });

  return (
    <section className="recipe-search" aria-label="Find a recipe">
      <div className="recipe-search__fields">
        <div className="recipe-search__field">
          <label htmlFor={textId} className="recipe-search__label">
            Search by name
          </label>
          <div className="recipe-search__input">
            <SearchIcon size={18} />
            <input
              id={textId}
              type="search"
              value={text}
              placeholder="Pancakes, soup, banana bread…"
              autoComplete="off"
              maxLength={120}
              onChange={(event) => onText(event.target.value)}
            />
          </div>
        </div>

        <div className="recipe-search__field">
          <label htmlFor={ingredientId} className="recipe-search__label">
            What&rsquo;s in your fridge?
          </label>
          <div className="recipe-search__input recipe-search__input--chips">
            {ingredients.map((name) => (
              <span key={name} className="ingredient-chip">
                {name}
                <button type="button" className="ingredient-chip__remove" aria-label={`Remove ${name}`} onClick={() => remove(name)}>
                  <CloseIcon size={12} />
                </button>
              </span>
            ))}
            <input
              id={ingredientId}
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={showList && highlight >= 0 ? `${listId}-${highlight}` : undefined}
              value={draft}
              placeholder={ingredients.length ? 'Add another…' : 'Add an ingredient, like egg'}
              autoComplete="off"
              maxLength={80}
              onChange={(event) => {
                setDraft(event.target.value);
                setHighlight(-1);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKeyDown}
            />
          </div>
          {showList && (
            <ul id={listId} role="listbox" aria-label="Ingredient suggestions" className="recipe-search__suggestions">
              {suggestions.map((entry, i) => (
                <li
                  key={entry.name}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === highlight}
                  className={i === highlight ? 'is-active' : undefined}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    add(entry.name);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  <span>{entry.name}</span>
                  <span className="recipe-search__suggestion-count">{countLabel(entry.recipes.length, 'recipe')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="recipe-search__chapters" role="group" aria-label="Chapters">
        <ChapterPill name="All" tabColor="rose" active={!chapterId} count={total} onClick={() => pick('')} />
        {chapters.map((chapter) => (
          <ChapterPill
            key={chapter.id}
            name={chapter.name}
            tabColor={chapter.tabColor}
            count={chapter.recipeCount}
            active={chapterId === chapter.id}
            onClick={() => pick(chapter.id)}
          />
        ))}
        {(unsortedCount > 0 || chapterId === 'unsorted') && (
          <ChapterPill name="Unsorted" tabColor="paper" count={unsortedCount} active={chapterId === 'unsorted'} onClick={() => pick('unsorted')} />
        )}
      </div>
    </section>
  );
}
