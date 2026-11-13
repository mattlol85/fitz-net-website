import React from 'react';
import { AlertIcon, CloseIcon } from './icons';

/**
 * Above the composer: a warning when older messages no longer fit the selected model's window
 * (with the explicit Summarise action), or a quiet note when a summary stands in for them.
 */
export default function ContextBanner({ warning, summaryActive, summaryPartial, summarizing, onSummarize, onDismiss }) {
  if (warning) {
    const { count, model } = warning;
    return (
      <div className="ai-chat__banner ai-chat__banner--warn" role="status">
        <AlertIcon size={16} />
        <span className="ai-chat__banner-text">
          {count === 1
            ? `1 older message doesn't fit ${model}'s context window and won't be sent.`
            : `${count} older messages don't fit ${model}'s context window and won't be sent.`}
        </span>
        <button type="button" className="ai-chat__button" disabled={summarizing} onClick={onSummarize}>
          {summarizing ? (
            <>
              <span className="ai-chat__spinner" aria-hidden="true" /> Summarising…
            </>
          ) : (
            'Summarise older turns'
          )}
        </button>
        <button type="button" className="ai-chat__icon-button" aria-label="Dismiss warning" onClick={onDismiss}>
          <CloseIcon size={14} />
        </button>
      </div>
    );
  }

  if (summaryActive) {
    return (
      <p className="ai-chat__banner ai-chat__banner--quiet" role="status">
        Older turns are summarised for this model
        {summaryPartial && ' Only the most recent part of the older turns could be summarised.'}
      </p>
    );
  }

  return null;
}
