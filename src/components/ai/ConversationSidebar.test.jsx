import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConversationSidebar from './ConversationSidebar';
import { makeConversation } from './aiTestData';

afterEach(cleanup);

const ITEMS = [
  makeConversation({ id: 'p1', title: 'Pinned chat', pinned: true }),
  makeConversation({ id: 'r1', title: 'Recent one' }),
  makeConversation({ id: 'r2', title: 'Recent two' }),
];

function setup(props = {}) {
  const handlers = {
    onSearchChange: vi.fn(),
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    onClose: vi.fn(),
    onSelect: vi.fn(),
    onNew: vi.fn(),
    onRename: vi.fn().mockResolvedValue({}),
    onPin: vi.fn().mockResolvedValue({}),
    onDelete: vi.fn().mockResolvedValue(undefined),
  };
  render(
    <ConversationSidebar
      items={ITEMS}
      loading={false}
      error={null}
      search=""
      hasMore={false}
      activeId="r1"
      open
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

const openMenu = async (user, title) => {
  await user.click(screen.getByRole('button', { name: `Actions for ${title}` }));
  return screen.getByRole('menu');
};

describe('ConversationSidebar', () => {
  it('should list pinned conversations in their own section above the rest', () => {
    setup();

    const pinned = screen.getByRole('region', { name: 'Pinned' });
    const recent = screen.getByRole('region', { name: 'Recent' });
    expect(within(pinned).getByText('Pinned chat')).toBeInTheDocument();
    expect(within(recent).getAllByRole('listitem')).toHaveLength(2);
    expect(pinned.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should highlight the open conversation and select another on click', async () => {
    const user = userEvent.setup();
    const { onSelect } = setup();

    expect(screen.getByRole('button', { name: 'Recent one' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Recent two' }));

    expect(onSelect).toHaveBeenCalledWith('r2');
  });

  it('should start a new chat and close the drawer', async () => {
    const user = userEvent.setup();
    const { onNew, onClose } = setup();

    await user.click(screen.getByRole('button', { name: /new chat/i }));
    // Only shown in the mobile drawer, so the stylesheet hides it here.
    fireEvent.click(screen.getByLabelText('Close conversations'));

    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should report search input changes', () => {
    const { onSearchChange } = setup();

    fireEvent.change(screen.getByRole('searchbox', { name: /search conversations/i }), {
      target: { value: 'bell' },
    });

    expect(onSearchChange).toHaveBeenCalledWith('bell');
  });

  it('should show results with match snippets and no pinned section while searching', () => {
    setup({
      search: 'bell',
      items: [makeConversation({ id: 'r1', title: 'Hit', pinned: true, matchSnippet: '…the bell rings…' })],
    });

    expect(screen.queryByRole('region', { name: 'Pinned' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Results' })).toBeInTheDocument();
    expect(screen.getByText('…the bell rings…')).toBeInTheDocument();
  });

  it('should rename inline: Enter saves, Escape cancels', async () => {
    const user = userEvent.setup();
    const { onRename } = setup();

    await openMenu(user, 'Recent two');
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByRole('textbox', { name: /conversation title/i });
    expect(input).toHaveValue('Recent two');
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, 'Better name{Enter}');

    expect(onRename).toHaveBeenCalledWith('r2', 'Better name');
    expect(screen.queryByRole('textbox', { name: /conversation title/i })).not.toBeInTheDocument();

    await openMenu(user, 'Recent one');
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    await user.type(screen.getByRole('textbox', { name: /conversation title/i }), ' extra{Escape}');

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Recent one' })).toBeInTheDocument();
  });

  it('should not rename to an empty or unchanged title', async () => {
    const user = userEvent.setup();
    const { onRename } = setup();

    await openMenu(user, 'Recent two');
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    await user.clear(screen.getByRole('textbox', { name: /conversation title/i }));
    await user.keyboard('{Enter}');

    expect(onRename).not.toHaveBeenCalled();
  });

  it('should pin and unpin from the row menu', async () => {
    const user = userEvent.setup();
    const { onPin } = setup();

    await openMenu(user, 'Recent two');
    await user.click(screen.getByRole('menuitem', { name: /^pin/i }));
    expect(onPin).toHaveBeenCalledWith('r2', true);

    await openMenu(user, 'Pinned chat');
    await user.click(screen.getByRole('menuitem', { name: /unpin/i }));
    expect(onPin).toHaveBeenLastCalledWith('p1', false);
  });

  it('should ask twice before deleting, and let you back out', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup();

    await openMenu(user, 'Recent two');
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete this chat?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Recent two' })).toBeInTheDocument();

    await openMenu(user, 'Recent two');
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: /confirm delete/i }));

    expect(onDelete).toHaveBeenCalledWith('r2');
  });

  it('should close the row menu on Escape and on an outside click', async () => {
    const user = userEvent.setup();
    setup();

    await openMenu(user, 'Recent two');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await openMenu(user, 'Recent two');
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should surface a failed row action', async () => {
    const user = userEvent.setup();
    setup({ onPin: vi.fn().mockRejectedValue(new Error('Server said no')) });

    await openMenu(user, 'Recent two');
    await user.click(screen.getByRole('menuitem', { name: /^pin/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server said no');
  });

  it('should show loading, error and empty states', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ConversationSidebar items={[]} loading error={null} search="" open onSearchChange={vi.fn()} />
    );
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    unmount();

    const onRetry = vi.fn();
    const failed = render(
      <ConversationSidebar items={[]} loading={false} error="x" search="" open onRetry={onRetry} onSearchChange={vi.fn()} />
    );
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
    failed.unmount();

    render(<ConversationSidebar items={[]} loading={false} error={null} search="zzz" open onSearchChange={vi.fn()} />);
    expect(screen.getByText(/no chats match/i)).toBeInTheDocument();
  });

  it('should offer to load more when the list has another page', async () => {
    const user = userEvent.setup();
    const { onLoadMore } = setup({ hasMore: true });

    await user.click(screen.getByRole('button', { name: /show more/i }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
