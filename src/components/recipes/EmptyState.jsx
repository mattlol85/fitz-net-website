import React from 'react';
import { BowlIllustration, PlateSearchIllustration } from './doodles';
import '../../css/recipes/EmptyState.css';

/**
 * A friendly "nothing here yet" block: an SVG illustration, a heading, a line of text and
 * (as children) the one thing to do next. `variant` picks the picture: "box" for an empty book,
 * "search" for a search with no matches.
 */
export default function EmptyState({ variant = 'box', title, text, children, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  const Illustration = variant === 'search' ? PlateSearchIllustration : BowlIllustration;
  return (
    <div className="empty-state" data-variant={variant}>
      <Illustration className="empty-state__art" />
      <Heading className="empty-state__title">{title}</Heading>
      {text && <p className="empty-state__text">{text}</p>}
      {children && <div className="empty-state__actions">{children}</div>}
    </div>
  );
}
