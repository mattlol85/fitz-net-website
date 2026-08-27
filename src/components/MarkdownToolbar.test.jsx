import React, { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
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
