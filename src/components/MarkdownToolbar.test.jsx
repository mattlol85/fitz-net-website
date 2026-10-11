import React, { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import MarkdownToolbar, { applyAction, ACTIONS } from './MarkdownToolbar';

function Harness({ initial = '' }) {
  const ref = useRef(null);
  return (
    <div>
      <textarea ref={ref} defaultValue={initial} data-testid="ta" />
      <MarkdownToolbar textareaRef={ref} />
    </div>
  );
}

describe('MarkdownToolbar', () => {
  test('should hide the action menu until the trigger is clicked', () => {
    render(<Harness />);
    expect(screen.queryByTestId('md-toolbar-menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('md-toolbar-trigger'));
    expect(screen.getByTestId('md-toolbar-menu')).toBeInTheDocument();
  });

  test('should render an action button for every markdown action', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('md-toolbar-trigger'));
    ACTIONS.forEach((a) => {
      expect(screen.getByTestId(`md-action-${a.key}`)).toBeInTheDocument();
    });
  });

  test('should wrap the current selection in bold markers', () => {
    render(<Harness initial="hello world" />);
    const ta = screen.getByTestId('ta');
    ta.setSelectionRange(0, 5);
    fireEvent.click(screen.getByTestId('md-toolbar-trigger'));
    fireEvent.click(screen.getByTestId('md-action-bold'));
    expect(ta.value).toBe('**hello** world');
  });

  test('should insert a placeholder when nothing is selected', () => {
    render(<Harness initial="" />);
    const ta = screen.getByTestId('ta');
    ta.setSelectionRange(0, 0);
    fireEvent.click(screen.getByTestId('md-toolbar-trigger'));
    fireEvent.click(screen.getByTestId('md-action-italic'));
    expect(ta.value).toBe('_italic text_');
  });

  test('applyAction should prefix a bullet for list action', () => {
    const ta = document.createElement('textarea');
    ta.value = 'item';
    ta.setSelectionRange(0, 4);
    applyAction(ta, ACTIONS.find((a) => a.key === 'list'));
    expect(ta.value).toBe('- item');
  });
});

describe('MarkdownToolbar edge cases', () => {
  test('should close the menu when the user presses outside it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('md-toolbar-trigger'));
    expect(screen.getByTestId('md-toolbar-menu')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId('md-toolbar-menu')).not.toBeInTheDocument();
  });

  test('should keep the menu open when the user presses inside it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('md-toolbar-trigger'));

    fireEvent.mouseDown(screen.getByTestId('md-toolbar-menu'));

    expect(screen.getByTestId('md-toolbar-menu')).toBeInTheDocument();
  });

  test('should stop the trigger and menu items from stealing focus from the textarea', () => {
    render(<Harness />);
    const trigger = screen.getByTestId('md-toolbar-trigger');
    expect(fireEvent.mouseDown(trigger)).toBe(false);
    fireEvent.click(trigger);

    expect(fireEvent.mouseDown(screen.getByTestId('md-action-bold'))).toBe(false);
  });

  test('should do nothing when an action runs without a textarea to act on', () => {
    render(<MarkdownToolbar />);
    fireEvent.click(screen.getByTestId('md-toolbar-trigger'));

    expect(() => fireEvent.click(screen.getByTestId('md-action-bold'))).not.toThrow();
  });

  test('applyAction should ignore a missing textarea', () => {
    expect(() => applyAction(null, ACTIONS[0])).not.toThrow();
  });

  test('applyAction should treat missing selection offsets as the end of the text', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'hello';
    Object.defineProperty(textarea, 'selectionStart', { configurable: true, get: () => null });
    Object.defineProperty(textarea, 'selectionEnd', { configurable: true, get: () => null });

    applyAction(textarea, ACTIONS[0]);

    expect(textarea.value).toBe('hello**bold text**');
  });

  test('applyAction should fall back to a direct assignment when the native setter is unavailable', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'hi';
    textarea.setSelectionRange(0, 2);
    const realGetDescriptor = Object.getOwnPropertyDescriptor;
    const spy = vi.spyOn(Object, 'getOwnPropertyDescriptor').mockImplementation((obj, key) => (
      obj === window.HTMLTextAreaElement.prototype ? undefined : realGetDescriptor(obj, key)
    ));

    applyAction(textarea, ACTIONS[2]);
    spy.mockRestore();

    expect(textarea.value).toBe('~~hi~~');
  });

  test('applyAction should prefix an empty list item when nothing is selected', () => {
    const textarea = document.createElement('textarea');
    textarea.value = '';

    applyAction(textarea, ACTIONS[5]);

    expect(textarea.value).toBe('- ');
  });
});
