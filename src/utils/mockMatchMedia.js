/**
 * Test helper: jsdom has no window.matchMedia. Installs one that answers the queries used in
 * src/constants/breakpoints.js for a given viewport, so a component can be rendered in phone or
 * desktop mode. Returns a restore function.
 *
 *   const restore = mockMatchMedia({ width: 375, touch: true });
 *   ...
 *   restore();
 */
export function evaluateQuery(query, { width = 1024, touch = false } = {}) {
  return query
    .split(/\s+and\s+/)
    .map((part) => part.trim().replace(/^\(|\)$/g, ''))
    .every((feature) => {
      const [name, rawValue] = feature.split(':').map((s) => s.trim());
      const px = parseFloat(rawValue);
      switch (name) {
        case 'min-width':
          return width >= px;
        case 'max-width':
          return width <= px;
        case 'hover':
          return rawValue === (touch ? 'none' : 'hover');
        case 'pointer':
          return rawValue === (touch ? 'coarse' : 'fine');
        default:
          return false;
      }
    });
}

export function mockMatchMedia(viewport = {}) {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: evaluateQuery(query, viewport),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
  return () => {
    if (original) {
      window.matchMedia = original;
    } else {
      delete window.matchMedia;
    }
  };
}
