import React from 'react';
import { chapterStyle } from '../../utils/recipeColors';
import '../../css/recipes/ChapterPill.css';

/**
 * A soft pastel pill tinted by a chapter's `tabColor`. With `onClick` it is a toggle button
 * (`active` -> aria-pressed) used by the filter row and the form's chapter picker; without, it is
 * a plain label on a card.
 */
export default function ChapterPill({ name, tabColor, count, active = false, onClick, size = 'md', children, ...rest }) {
  const className = `chapter-pill chapter-pill--${size}${active ? ' chapter-pill--active' : ''}`;
  const label = (
    <>
      <span className="chapter-pill__dot" aria-hidden="true" />
      <span className="chapter-pill__name">{children ?? name}</span>
      {typeof count === 'number' && <span className="chapter-pill__count">{count}</span>}
    </>
  );
  if (!onClick) {
    return (
      <span className={className} style={chapterStyle(tabColor)} {...rest}>
        {label}
      </span>
    );
  }
  return (
    <button type="button" className={className} style={chapterStyle(tabColor)} aria-pressed={active} onClick={onClick} {...rest}>
      {label}
    </button>
  );
}
