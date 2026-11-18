import { useEffect } from 'react';

/**
 * How much of the layout viewport the on-screen keyboard covers, in CSS px.
 *
 * iOS Safari overlays the keyboard on the page instead of resizing it, so a `bottom: 0` sticky
 * element ends up behind it. Android Chrome resizes the layout viewport (we opt in with
 * interactive-widget=resizes-content), which makes this come out as 0 there.
 */
export function keyboardInset(win = window) {
  const vv = win.visualViewport;
  if (!vv) return 0;
  const covered = win.innerHeight - vv.height - vv.offsetTop;
  // Pinch-zoom and toolbar animations produce small differences; ignore anything that's
  // clearly not a keyboard.
  return covered > 80 ? Math.round(covered) : 0;
}

/**
 * Publishes the keyboard height as the `--keyboard-inset` custom property on <html>, so CSS can
 * keep docked controls (the AI composer) above the keyboard.
 */
export default function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--keyboard-inset', `${keyboardInset(window)}px`);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
