import React, { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useAiChat from '../../hooks/useAiChat';
import usePresets from '../../hooks/usePresets';
import useTurnAnnouncement from '../../hooks/useTurnAnnouncement';
import useConversationList from '../../hooks/useConversationList';
import useModelCatalogue from '../../hooks/useModelCatalogue';
import ChatSettings from './ChatSettings';
import Composer from './Composer';
import ContextBanner from './ContextBanner';
import FailoverChoices from './FailoverChoices';
import ConversationSidebar from './ConversationSidebar';
import MessageList from './MessageList';
import ModelPicker from './ModelPicker';
import { deriveAlternatives, showsFailover, targetSupportsVision } from './aiChatUtils';
import { AlertIcon, CloseIcon, SidebarIcon } from './icons';
import '../../css/ai/layout.css';
import '../../css/ai/chat.css';
import '../../css/ai/controls.css';

const SIDEBAR_KEY = 'aiChat.sidebar';
const isDesktop = () => window.matchMedia?.('(min-width: 768px)').matches ?? true;

function readSidebarPreference() {
  if (!isDesktop()) return false;
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) !== 'closed';
  } catch {
    return true;
  }
}

/**
 * Matt-GPT: a conversation sidebar plus the chat column. The open conversation lives in the URL
 * (`/ai?c=<id>`) so a reload restores it; a new chat has no id until its first message.
 */
export default function AiChatPage() {
  const { token, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('c');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarPreference);

  const setConversationId = useCallback(
    (id, { replace = false } = {}) => setSearchParams(id ? { c: id } : {}, { replace }),
    [setSearchParams]
  );

  const models = useModelCatalogue({ token, fast: pickerOpen });
  const list = useConversationList({ token });
  const presets = usePresets({ token });
  const chat = useAiChat({
    token,
    conversationId,
    catalogue: models.catalogue,
    setConversationId,
    onListChange: list.reload,
    onWarmUp: models.refresh,
  });

  const toggleSidebar = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    if (isDesktop()) {
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? 'open' : 'closed');
      } catch {
        // Remembering the choice is a nicety.
      }
    }
  };

  const closeDrawer = () => {
    if (!isDesktop()) setSidebarOpen(false);
  };

  const handleSelect = (id) => {
    setConversationId(id);
    closeDrawer();
  };

  const handleNew = () => {
    chat.resetDraft();
    setConversationId(null);
    closeDrawer();
  };

  const handleRename = async (id, title) => {
    const updated = await list.rename(id, title);
    chat.mergeConversation(updated);
  };

  const handlePin = async (id, pinned) => {
    const updated = await list.setPinned(id, pinned);
    chat.mergeConversation(updated);
  };

  const handleDelete = async (id) => {
    await list.remove(id);
    if (id === conversationId) setConversationId(null, { replace: true });
  };

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const regenerate = useCallback((message, target) => chat.regenerate(message.id, target), [chat.regenerate]);
  const edit = useCallback((message, text) => chat.edit(message.id, text), [chat.edit]);

  // The selection pins a node the catalogue now reports OFFLINE: offer the one-click ways out.
  const pinnedNode = chat.target?.nodeId
    ? models.catalogue?.nodes?.find((n) => n.id === chat.target.nodeId)
    : null;
  const lastMessage = chat.messages[chat.messages.length - 1];
  // The error under the last reply already offers the same choices; do not say it twice.
  const offlineNode = pinnedNode?.status === 'OFFLINE' && !showsFailover(lastMessage) ? pinnedNode : null;
  const vision = targetSupportsVision(models.catalogue, chat.target);
  const announcement = useTurnAnnouncement(chat.messages, chat.streaming, conversationId);

  const hasConversation = Boolean(conversationId);
  const noModels = Boolean(models.catalogue) && models.catalogue.models.length === 0;
  const title = chat.conversation?.title || 'Matt-GPT';

  return (
    <div className="ai-chat" data-sidebar={sidebarOpen ? 'open' : 'closed'}>
      <div className="ai-chat__sr" aria-live="polite" data-testid="turn-announcement">
        {announcement}
      </div>
      <ConversationSidebar
        items={list.items}
        loading={list.loading}
        error={list.error}
        search={list.search}
        onSearchChange={list.setSearch}
        hasMore={list.hasMore}
        onLoadMore={list.loadMore}
        onRetry={list.reload}
        activeId={conversationId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={handleSelect}
        onNew={handleNew}
        onRename={handleRename}
        onPin={handlePin}
        onDelete={handleDelete}
      />
      {sidebarOpen && <div className="ai-chat__backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <section className="ai-chat__main" aria-label="Chat">
        <div className="ai-chat__column">
          {/* A div, not <header>: App.css styles the bare header and nav elements for the site chrome. */}
          <div className="ai-chat__header">
            <button
              type="button"
              className="ai-chat__icon-button"
              aria-label={sidebarOpen ? 'Hide conversations' : 'Show conversations'}
              aria-expanded={sidebarOpen}
              onClick={toggleSidebar}
            >
              <SidebarIcon size={20} />
            </button>
            <h1 className="ai-chat__title" title={title}>{title}</h1>
            <ModelPicker
              catalogue={models.catalogue}
              loading={models.loading}
              error={models.error}
              target={chat.target}
              onSelect={chat.selectTarget}
              presets={presets.items}
              activePresetId={chat.settings.presetId}
              onSelectPreset={chat.applyPreset}
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onRefresh={models.refresh}
            />
            <ChatSettings
              settings={chat.settings}
              presets={presets}
              catalogue={models.catalogue}
              canShare={Boolean(hasPermission?.('ADMIN'))}
              onApplyPreset={chat.applyPreset}
              onSavePrompt={chat.saveSystemPrompt}
            />
          </div>

          <div className="ai-chat__body">
            {chat.loading && (
              <p className="ai-chat__state" role="status">Loading conversation…</p>
            )}

            {chat.loadError && (
              <div className="ai-chat__state" role="alert">
                <p>{chat.loadError}</p>
                <div className="ai-chat__state-actions">
                  {hasConversation && (
                    <button type="button" className="ai-chat__button" onClick={chat.retryLoad}>Try again</button>
                  )}
                  <button type="button" className="ai-chat__button" onClick={handleNew}>New chat</button>
                </div>
              </div>
            )}

            {!chat.loading && !chat.loadError && chat.messages.length === 0 && (
              <div className="ai-chat__empty">
                <div className="ai-chat__avatar ai-chat__avatar--large" aria-hidden="true">M</div>
                <h2>How can I help?</h2>
                <p>
                  {noModels
                    ? 'No AI nodes are online right now. Check the Status tab, then try again.'
                    : 'Pick a model at the top, or leave it on Auto and the best available node answers.'}
                </p>
              </div>
            )}

            {chat.messages.length > 0 && (
              <MessageList
                messages={chat.messages}
                resetKey={conversationId}
                streaming={chat.streaming}
                catalogue={models.catalogue}
                target={chat.target}
                onRegenerate={regenerate}
                onEdit={edit}
                onOpenPicker={openPicker}
                onRefreshModels={models.refresh}
              />
            )}
          </div>

          <div className="ai-chat__dock">
            {chat.notice && (
              <div className="ai-chat__notice" role="alert">
                <AlertIcon size={16} />
                <span>{chat.notice}</span>
                <button
                  type="button"
                  className="ai-chat__icon-button"
                  aria-label="Dismiss"
                  onClick={chat.dismissNotice}
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            )}
            {offlineNode && (
              <div className="ai-chat__banner ai-chat__banner--warn" role="status">
                <AlertIcon size={16} />
                <span className="ai-chat__banner-text">{offlineNode.name} is offline.</span>
                <FailoverChoices
                  alternatives={deriveAlternatives(models.catalogue, chat.target.model, offlineNode.id)}
                  model={chat.target.model}
                  onChoose={chat.selectTarget}
                  onOpenPicker={openPicker}
                />
              </div>
            )}
            <ContextBanner
              warning={chat.trimWarning}
              summaryActive={chat.summaryActive}
              summaryPartial={chat.summaryPartial}
              summarizing={chat.summarizing}
              onSummarize={chat.summarize}
              onDismiss={chat.dismissTrim}
            />
            <Composer
              onSend={chat.send}
              onStop={chat.stop}
              streaming={chat.streaming}
              canSend={Boolean(chat.target) && !chat.loading && !chat.loadError}
              usage={chat.usage}
              vision={vision}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
