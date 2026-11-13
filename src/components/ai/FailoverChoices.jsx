import React from 'react';

/**
 * One-click ways out when a node cannot serve the selected model: one button per node that has
 * it (with a Loaded badge for warm ones), plus Auto. With none left, say so and offer the picker.
 */
export default function FailoverChoices({ alternatives, model, disabled = false, onChoose, onOpenPicker }) {
  if (!alternatives.length) {
    return (
      <div className="ai-chat__choices">
        <span>No other node has {model} right now.</span>
        <button type="button" className="ai-chat__button" onClick={onOpenPicker}>
          Choose another model
        </button>
      </div>
    );
  }

  return (
    <div className="ai-chat__choices" role="group" aria-label="Other ways to run this">
      {alternatives.map((alt) => (
        <button
          key={alt.nodeId}
          type="button"
          className="ai-chat__button"
          disabled={disabled}
          onClick={() => onChoose({ model: alt.model, nodeId: alt.nodeId })}
        >
          Use {alt.model} on {alt.nodeName}
          {alt.loaded && <span className="ai-chat__badge ai-chat__badge--loaded">Loaded</span>}
        </button>
      ))}
      <button
        type="button"
        className="ai-chat__button"
        disabled={disabled}
        onClick={() => onChoose({ model, nodeId: null })}
      >
        Switch to Auto
      </button>
    </div>
  );
}
