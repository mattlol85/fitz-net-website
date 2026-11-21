import React, { useCallback, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { useRecipeBook } from '../../hooks/useRecipes';
import EmptyState from './EmptyState';
import RecipeDetail from './RecipeDetail';
import RecipeForm from './RecipeForm';
import RecipeList from './RecipeList';
import RecipeSettings from './RecipeSettings';
// The one friendly heading font, self-hosted and only in this lazy chunk (no third-party requests).
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '../../css/recipes/RecipeBox.css';

/** Waits for the book (chapters, title, colour) before showing a page that needs it. */
function NeedsBook({ bookState, children }) {
  if (bookState.data) return children(bookState.data);
  if (bookState.error) {
    return (
      <div className="rb-notice" role="alert">
        <p>{bookState.error}</p>
        <button type="button" className="rb-button" onClick={bookState.reload}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <p className="rb-loading" role="status">
      Opening your recipe box…
    </p>
  );
}

/**
 * Lori-Net's recipe box, mounted at /recipes/*. It owns the book, and a `version` that every save
 * or delete bumps so the lists and details refetch.
 *
 *   /recipes            the box: banner, search, grid
 *   /recipes/new        add a recipe          /recipes/:id/edit   edit one
 *   /recipes/:id        a recipe              /recipes/settings   the book and its chapters
 */
export default function RecipeBox() {
  const [version, setVersion] = useState(0);
  const onChanged = useCallback(() => setVersion((v) => v + 1), []);
  const bookState = useRecipeBook(version);
  const shared = { version, onChanged };

  return (
    <div className="recipe-box">
      <Routes>
        <Route index element={<RecipeList bookState={bookState} version={version} />} />
        <Route path="new" element={<NeedsBook bookState={bookState}>{(book) => <RecipeForm book={book} {...shared} />}</NeedsBook>} />
        <Route path="settings" element={<NeedsBook bookState={bookState}>{(book) => <RecipeSettings book={book} {...shared} />}</NeedsBook>} />
        <Route path=":id" element={<NeedsBook bookState={bookState}>{(book) => <RecipeDetail book={book} {...shared} />}</NeedsBook>} />
        <Route path=":id/edit" element={<NeedsBook bookState={bookState}>{(book) => <RecipeForm book={book} {...shared} />}</NeedsBook>} />
        <Route
          path="*"
          element={
            <EmptyState variant="search" title="That page isn't in the box" text="Maybe it was moved.">
              <Link to="/recipes" className="rb-button rb-button--primary">
                Back to the recipe box
              </Link>
            </EmptyState>
          }
        />
      </Routes>
    </div>
  );
}
