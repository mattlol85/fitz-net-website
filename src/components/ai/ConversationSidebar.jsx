import React, { useEffect, useRef, useState } from 'react';
import { CloseIcon, MoreIcon, PencilIcon, PinIcon, PlusIcon, SearchIcon, TrashIcon } from './icons';
import '../../css/ai/sidebar.css';

function ConversationRow({
  conversation,
  active,
  menuOpen,
  renaming,
  confirmingDelete,
  onSelect,
  onToggleMenu,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onTogglePin,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  const [draft, setDraft] = useState(conversation.title);
  const inputRef = useRef(null);
  // Enter, Esc and blur all end an edit; whichever comes first wins.
  const finishedRef = useRef(false);

  useEffect(() => {
    if (renaming) {
      finishedRef.current = false;
      setDraft(conversation.title);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming, conversation.title]);

  const cancel = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onCancelRename();
  };

  const commit = () => {
    if (finishedRef.current) return;
    const title = draft.trim();
    if (!title || title === conversation.title) {
      cancel();
      return;
    }
    finishedRef.current = true;
    onSaveRename(conversation.id, title);
  };

  const classes = [
    'ai-chat__conv',
    active && 'ai-chat__conv--active',
    (menuOpen || renaming || confirmingDelete) && 'ai-chat__conv--busy',
  ]
    .filter(Boolean)
    .join(' ');

  if (confirmingDelete) {
    return (
      <li className={classes}>
        <div className="ai-chat__conv-confirm" role="group" aria-label={`Delete ${conversation.title}?`}>
          <span>Delete this chat?</span>
          <button type="button" className="ai-chat__button ai-chat__button--danger" onClick={() => onConfirmDelete(conversation.id)}>
            Confirm delete
          </button>
          <button type="button" className="ai-chat__button" onClick={onCancelDelete}>
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={classes}>
      {renaming ? (
        <input
          ref={inputRef}
          className="ai-chat__conv-rename"
          aria-label="Conversation title"
          value={draft}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              cancel();
            }
          }}
          onBlur={commit}
        />
      ) : (
        <button
          type="button"
          className="ai-chat__conv-main"
          aria-current={active ? 'page' : undefined}
          onClick={() => onSelect(conversation.id)}
        >
          {conversation.pinned && <PinIcon size={13} className="ai-chat__conv-pin" />}
          <span className="ai-chat__conv-text">
            <span className="ai-chat__conv-title">{conversation.title}</span>
            {conversation.matchSnippet && (
              <span className="ai-chat__conv-snippet">{conversation.matchSnippet}</span>
            )}
          </span>
        </button>
      )}

      {!renaming && (
        <div className="ai-chat__conv-actions" data-conv-menu>
          <button
            type="button"
            className="ai-chat__icon-button ai-chat__conv-more"
            aria-label={`Actions for ${conversation.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => onToggleMenu(conversation.id)}
          >
            <MoreIcon size={16} />
          </button>
          {menuOpen && (
            <div className="ai-chat__menu" role="menu" aria-label={`${conversation.title} actions`}>
              <button type="button" role="menuitem" onClick={() => onStartRename(conversation.id)}>
                <PencilIcon size={14} /> Rename
              </button>
              <button type="button" role="menuitem" onClick={() => onTogglePin(conversation)}>
                <PinIcon size={14} /> {conversation.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" role="menuitem" className="ai-chat__menu-danger" onClick={() => onAskDelete(conversation.id)}>
                <TrashIcon size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The conversation list: New chat, debounced search, pinned section first, and a per-row menu
 * (rename in place, pin/unpin, delete behind a second confirmation). Below 768px it is a drawer.
 */
export default function ConversationSidebar({
  items,
  loading,
  error,
  search,
  onSearchChange,
  hasMore,
  onLoadMore,
  onRetry,
  activeId,
  open,
  onClose,
  onSelect,
  onNew,
  onRename,
  onPin,
  onDelete,
}) {
  const [menuId, setMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (!menuId) return undefined;
    const onMouseDown = (e) => {
      if (!e.target.closest?.('[data-conv-menu]')) setMenuId(null);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuId]);

  const attempt = async (action) => {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err.message || 'That did not work. Try again.');
    }
  };

  const searching = search.trim().length > 0;
  const pinned = items.filter((c) => c.pinned);
  const recent = searching ? items : items.filter((c) => !c.pinned);

  const renderRows = (rows) =>
    rows.map((conversation) => (
      <ConversationRow
        key={conversation.id}
        conversation={conversation}
        active={conversation.id === activeId}
        menuOpen={menuId === conversation.id}
        renaming={renamingId === conversation.id}
        confirmingDelete={deletingId === conversation.id}
        onSelect={onSelect}
        onToggleMenu={(id) => setMenuId((current) => (current === id ? null : id))}
        onStartRename={(id) => {
          setMenuId(null);
          setRenamingId(id);
        }}
        onSaveRename={(id, title) => {
          setRenamingId(null);
          attempt(() => onRename(id, title));
        }}
        onCancelRename={() => setRenamingId(null)}
        onTogglePin={(c) => {
          setMenuId(null);
          attempt(() => onPin(c.id, !c.pinned));
        }}
        onAskDelete={(id) => {
          setMenuId(null);
          setDeletingId(id);
        }}
        onConfirmDelete={(id) => {
          setDeletingId(null);
          attempt(() => onDelete(id));
        }}
        onCancelDelete={() => setDeletingId(null)}
      />
    ));

  return (
    <aside className="ai-chat__sidebar" aria-label="Conversations" data-open={open}>
      <div className="ai-chat__sidebar-inner">
        <div className="ai-chat__sidebar-top">
          <button type="button" className="ai-chat__new-chat" onClick={onNew}>
            <PlusIcon size={16} /> New chat
          </button>
          <button
            type="button"
            className="ai-chat__icon-button ai-chat__sidebar-close"
            aria-label="Close conversations"
            onClick={onClose}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="ai-chat__search">
          <SearchIcon size={15} />
          <input
            type="search"
            aria-label="Search conversations"
            placeholder="Search chats…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* role=navigation on a div: App.css styles the bare nav element for the site navbar. */}
        <div className="ai-chat__conv-scroll" role="navigation" aria-label="Conversation list">
          {loading && items.length === 0 && (
            <p className="ai-chat__sidebar-note" role="status">Loading conversations…</p>
          )}
          {error && (
            <div className="ai-chat__sidebar-note" role="alert">
              <p>Couldn&apos;t load conversations.</p>
              <button type="button" className="ai-chat__button" onClick={onRetry}>Try again</button>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="ai-chat__sidebar-note">
              {searching ? `No chats match “${search.trim()}”.` : 'No conversations yet. Say hello!'}
            </p>
          )}

          {!searching && pinned.length > 0 && (
            <section aria-label="Pinned">
              <h2 className="ai-chat__sidebar-heading">Pinned</h2>
              <ul className="ai-chat__conv-list">{renderRows(pinned)}</ul>
            </section>
          )}
          {recent.length > 0 && (
            <section aria-label={searching ? 'Results' : 'Recent'}>
              {(searching || pinned.length > 0) && (
                <h2 className="ai-chat__sidebar-heading">{searching ? 'Results' : 'Recent'}</h2>
              )}
              <ul className="ai-chat__conv-list">{renderRows(recent)}</ul>
            </section>
          )}

          {hasMore && (
            <button type="button" className="ai-chat__button ai-chat__load-more" onClick={onLoadMore}>
              Show more
            </button>
          )}
        </div>

        {actionError && (
          <p className="ai-chat__sidebar-error" role="alert">{actionError}</p>
        )}
      </div>
    </aside>
  );
}
