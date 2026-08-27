import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../css/MarkdownToolbar.css';

/**
 * A "⋯" (three-dots) affordance shown at the bottom-right of the board compose
 * bubble. Clicking it reveals a small palette of markdown formatting actions
 * that wrap / prefix the current selection in the target <textarea>.
 */
const ACTIONS = [
  { key: 'bold',   label: 'B',  title: 'Bold',          wrap: ['**', '**'],   placeholder: 'bold text' },
  { key: 'italic', label: 'i',  title: 'Italic',        wrap: ['_', '_'],     placeholder: 'italic text' },
  { key: 'strike', label: 'S',  title: 'Strikethrough', wrap: ['~~', '~~'],   placeholder: 'struck text' },
  { key: 'code',   label: '</>',title: 'Inline code',   wrap: ['`', '`'],     placeholder: 'code' },
  { key: 'link',   label: '🔗', title: 'Link',          wrap: ['[', '](url)'],placeholder: 'text' },
  { key: 'list',   label: '•',  title: 'Bullet list',   prefix: '- ' },
];

function applyAction(textarea, action) {
  if (!textarea) return;
  const { value } = textarea;
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const selected = value.slice(start, end);

  let insert;
  let cursorStart;
  let cursorEnd;

  if (action.prefix) {
    const body = selected || '';
    insert = action.prefix + body;
    cursorStart = start + action.prefix.length;
    cursorEnd = cursorStart + body.length;
  } else {
    const [open, close] = action.wrap;
    const body = selected || action.placeholder;
    insert = open + body + close;
    cursorStart = start + open.length;
    cursorEnd = cursorStart + body.length;
  }

  const next = value.slice(0, start) + insert + value.slice(end);

  // Use the native setter so React's onChange (if any) still fires.
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;
  if (setter) setter.call(textarea, next);
  else textarea.value = next;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  textarea.focus();
  textarea.setSelectionRange(cursorStart, cursorEnd);
}

function MarkdownToolbar({ textareaRef }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const toggle = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((o) => !o);
  }, []);

  const runAction = useCallback((action) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyAction(textareaRef?.current, action);
  }, [textareaRef]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open]);

  return (
    <div className="md-toolbar" ref={rootRef} data-testid="md-toolbar">
      <button
        type="button"
        className="md-toolbar__trigger"
        aria-label="Markdown formatting"
        aria-expanded={open}
        // keep the compose textarea from losing focus / blurring away
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        data-testid="md-toolbar-trigger"
      >
        &#8943;
      </button>

      {open && (
        <div className="md-toolbar__menu" role="menu" data-testid="md-toolbar-menu">
          {ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              className="md-toolbar__item"
              title={action.title}
              aria-label={action.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={runAction(action)}
              data-testid={`md-action-${action.key}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { applyAction, ACTIONS };
export default MarkdownToolbar;
