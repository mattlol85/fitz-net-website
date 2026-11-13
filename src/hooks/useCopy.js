import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Clipboard copy with brief "Copied" feedback. `copy(text)` resolves true when the text was
 * written; `copied` stays true for `resetMs`.
 */
export default function useCopy(resetMs = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        setCopied(false);
        return false;
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
      return true;
    },
    [resetMs]
  );

  return [copied, copy];
}
