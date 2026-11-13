import { createContext } from 'react';

/**
 * What the per-message controls need from the page: whether a turn is streaming (controls are
 * disabled), the catalogue and current target (for "Regenerate with..." and failover choices) and
 * the actions themselves. Provided by MessageList, read by MessageBubble and MessageActions.
 */
export const MessageControls = createContext({
  disabled: false,
  catalogue: null,
  target: null,
  onRegenerate: () => {},
  onEdit: () => {},
  onOpenPicker: () => {},
  onRefreshModels: () => {},
});
