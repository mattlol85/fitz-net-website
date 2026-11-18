/*
 * Shared responsive breakpoints. CSS custom properties can't be used inside @media, so the CSS
 * files repeat these literal values — keep them in step with this file:
 *
 *   small   (max-width: 480px)      narrow phones
 *   phone   (max-width: 600px)      phones
 *   tablet  (max-width: 767.98px)   phones + small tablets; desktop layout starts at 768px
 *   touch   (hover: none) and (pointer: coarse)
 *
 * The tablet edge is written as 767.98px (not 767 or 768) so it never overlaps the
 * (min-width: 768px) queries and fractional widths fall on exactly one side.
 */
export const BREAKPOINTS = Object.freeze({
  small: 480,
  phone: 600,
  desktop: 768,
});

export const MEDIA = Object.freeze({
  small: `(max-width: ${BREAKPOINTS.small}px)`,
  phone: `(max-width: ${BREAKPOINTS.phone}px)`,
  tablet: `(max-width: ${BREAKPOINTS.desktop - 0.02}px)`,
  desktop: `(min-width: ${BREAKPOINTS.desktop}px)`,
  touch: '(hover: none) and (pointer: coarse)',
});
