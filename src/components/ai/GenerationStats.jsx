import React, { useState } from 'react';
import { finiteNumber, formatDuration } from './aiChatUtils';

/**
 * Compact stats for one reply ("48.2 tok/s · 5.2 s") plus a Details disclosure with the full set.
 * Anything the API did not report is left out, never shown as 0 or NaN.
 */
export default function GenerationStats({ generation }) {
  const [open, setOpen] = useState(false);
  if (!generation) return null;

  const tokensPerSecond = finiteNumber(generation.tokensPerSecond);
  const totalMs = finiteNumber(generation.totalMs);
  const ttftMs = finiteNumber(generation.ttftMs);
  const loadMs = finiteNumber(generation.loadMs);
  const thinkingMs = finiteNumber(generation.thinkingMs);
  const promptTokens = finiteNumber(generation.promptTokens);
  const completionTokens = finiteNumber(generation.completionTokens);
  const contextLength = finiteNumber(generation.contextLength);

  const summary = [];
  if (tokensPerSecond != null) summary.push(`${tokensPerSecond.toFixed(1)} tok/s`);
  if (totalMs != null) summary.push(formatDuration(totalMs));

  const rows = [];
  if (ttftMs != null) rows.push(['Time to first token', formatDuration(ttftMs)]);
  if (totalMs != null) rows.push(['Total time', formatDuration(totalMs)]);
  if (loadMs != null && loadMs > 0) rows.push(['Model load', formatDuration(loadMs)]);
  if (thinkingMs != null) rows.push(['Thinking', formatDuration(thinkingMs)]);
  if (promptTokens != null && completionTokens != null) {
    rows.push(['Tokens (prompt → reply)', `${promptTokens.toLocaleString()} → ${completionTokens.toLocaleString()}`]);
  } else if (promptTokens != null) {
    rows.push(['Prompt tokens', promptTokens.toLocaleString()]);
  } else if (completionTokens != null) {
    rows.push(['Reply tokens', completionTokens.toLocaleString()]);
  }
  if (contextLength != null) rows.push(['Context length', contextLength.toLocaleString()]);
  if (generation.finishReason) rows.push(['Finish reason', generation.finishReason]);
  if (generation.presetName) rows.push(['Preset', generation.presetName]);

  if (!summary.length && !rows.length) return null;

  return (
    <>
      {summary.length > 0 && (
        <span className="ai-chat__stats" data-testid="generation-stats">
          {summary.join(' · ')}
        </span>
      )}
      {rows.length > 0 && (
        <button
          type="button"
          className="ai-chat__stats-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          Details
        </button>
      )}
      {open && (
        <dl className="ai-chat__stats-details" aria-label="Reply details">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}
