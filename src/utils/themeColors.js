import * as THREE from 'three';

/**
 * Resolve a CSS custom property (e.g. '--text-primary') on the document root
 * to a hex number three.js materials can consume. Falls back to `fallback`
 * (a hex number) when the variable is unset/unresolvable — happens in test
 * environments with no stylesheet loaded.
 */
export function resolveThemeColor(cssVarName, fallback = 0xffffff) {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
  if (!raw) return fallback;
  try {
    return new THREE.Color(raw).getHex();
  } catch {
    return fallback;
  }
}

/**
 * Watch the document root's `data-theme` attribute and invoke `onChange`
 * whenever it changes (light/dark toggle), so callers can re-resolve theme
 * colors on live materials. Returns a cleanup function.
 */
export function watchThemeChange(onChange) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.attributeName === 'data-theme')) {
      onChange();
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
