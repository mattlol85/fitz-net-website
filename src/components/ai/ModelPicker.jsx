import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  describeTarget,
  formatContext,
  formatVram,
  matchesQuery,
  sameTarget,
  statusLabel,
} from './aiChatUtils';
import {
  CheckIcon,
  ChevronDownIcon,
  EyeIcon,
  RefreshIcon,
  SearchIcon,
  SparkIcon,
} from './icons';
import '../../css/ai/picker.css';

const optionKey = (nodeId, model) => `${nodeId ?? 'auto'}:${model}`;

/**
 * Filters and shapes the catalogue into the picker's groups: an Auto group (one row per model
 * name) followed by one group per node. A search term keeps rows whose model name matches, or
 * every row of a node whose name matches. OFFLINE rows stay visible but are marked disabled.
 */
export function buildGroups(catalogue, query) {
  if (!catalogue) return [];
  const nodeName = (id) => catalogue.nodes?.find((n) => n.id === id)?.name;

  const autoRows = (catalogue.models || [])
    .filter((m) => matchesQuery(query, m.name, ...(m.nodeIds || []).map(nodeName)))
    .map((m) => ({
      key: optionKey(null, m.name),
      kind: 'auto',
      name: m.name,
      target: { model: m.name, nodeId: null },
      disabled: false,
      parameterSize: m.parameterSize,
      quantization: m.quantization,
      contextLength: m.contextLength,
      capabilities: m.capabilities || [],
      nodeCount: m.nodeIds?.length ?? 0,
      loaded: (m.loadedOn?.length ?? 0) > 0,
    }));

  const groups = [];
  if (autoRows.length) groups.push({ key: 'auto', kind: 'auto', title: 'Auto', rows: autoRows });

  (catalogue.nodes || []).forEach((node) => {
    const nodeMatches = matchesQuery(query, node.name);
    const offline = node.status === 'OFFLINE';
    const rows = (node.models || [])
      .filter((m) => nodeMatches || matchesQuery(query, m.name))
      .map((m) => ({
        key: optionKey(node.id, m.name),
        kind: 'node',
        name: m.name,
        target: { model: m.name, nodeId: node.id },
        disabled: offline,
        parameterSize: m.parameterSize,
        quantization: m.quantization,
        contextLength: m.contextLength,
        capabilities: m.capabilities || [],
        loaded: Boolean(m.loaded),
      }));
    if (rows.length) groups.push({ key: `node-${node.id}`, kind: 'node', node, rows });
  });

  return groups;
}

function Chip({ children, title }) {
  return (
    <span className="ai-chat__chip" title={title}>
      {children}
    </span>
  );
}

function OptionRow({ id, row, selected, active, onChoose, onHover }) {
  const context = formatContext(row.contextLength);
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={row.disabled || undefined}
      className={[
        'ai-chat__option',
        selected && 'ai-chat__option--selected',
        active && 'ai-chat__option--active',
        row.disabled && 'ai-chat__option--disabled',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => !row.disabled && onChoose(row)}
      onMouseMove={() => !row.disabled && onHover(row)}
    >
      <span className="ai-chat__option-check" aria-hidden="true">
        {selected && <CheckIcon size={14} />}
      </span>
      <span className="ai-chat__option-body">
        <span className="ai-chat__option-name">{row.name}</span>
        <span className="ai-chat__option-meta">
          {row.parameterSize && <Chip title="Parameters">{row.parameterSize}</Chip>}
          {row.quantization && <Chip title="Quantization">{row.quantization}</Chip>}
          {context && <Chip title={`Context window: ${row.contextLength.toLocaleString()} tokens`}>{context} ctx</Chip>}
          {row.kind === 'auto' && (
            <span className="ai-chat__option-note">
              {row.nodeCount} {row.nodeCount === 1 ? 'node' : 'nodes'}
            </span>
          )}
          {row.capabilities.includes('vision') && (
            <span className="ai-chat__option-note" title="Understands images">
              <EyeIcon size={13} /> Vision
            </span>
          )}
          {row.capabilities.includes('thinking') && (
            <span className="ai-chat__option-note" title="Shows its reasoning">
              <SparkIcon size={13} /> Thinking
            </span>
          )}
        </span>
      </span>
      {row.loaded && (
        <span className="ai-chat__badge ai-chat__badge--loaded" title="Already in GPU memory, so replies start fast">
          Loaded
        </span>
      )}
    </div>
  );
}

function NodeHeader({ id, node }) {
  const vram = formatVram(node.vram);
  return (
    <div id={id} className="ai-chat__group-header">
      <span
        className={`ai-chat__status-dot ai-chat__status-dot--${node.status.toLowerCase()}`}
        aria-hidden="true"
      />
      <span className="ai-chat__group-name">{node.name}</span>
      <span className="ai-chat__group-status">{statusLabel(node.status)}</span>
      {vram && (
        <span className="ai-chat__group-vram" title="GPU memory in use / total">
          {vram}
        </span>
      )}
      {node.catalogStale && (
        <span className="ai-chat__group-stale" title="This node's Ollama could not be reached, so this list may be out of date">
          cached
        </span>
      )}
    </div>
  );
}

/**
 * The one control that replaces the old node and model selects. A button showing the current
 * target opens a searchable popover (also Ctrl/Cmd+K): an Auto group, then a group per node.
 */
export default function ModelPicker({ catalogue, loading, error, target, onSelect, onOpenChange, onRefresh }) {
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState('');
  const [activeKey, setActiveKey] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const uid = useId();
  const panelId = `${uid}-panel`;
  const listId = `${uid}-list`;

  const setOpen = useCallback(
    (next) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  const groups = useMemo(() => buildGroups(catalogue, query), [catalogue, query]);
  const enabledRows = useMemo(
    () => groups.flatMap((g) => g.rows).filter((r) => !r.disabled),
    [groups]
  );
  const active = enabledRows.find((r) => r.key === activeKey) || enabledRows[0] || null;
  const optionId = (key) => `${uid}-opt-${key}`;

  const close = useCallback(
    ({ restoreFocus = true } = {}) => {
      setOpen(false);
      if (restoreFocus) buttonRef.current?.focus();
    },
    [setOpen]
  );

  const openPicker = useCallback(() => {
    setQuery('');
    const selected = catalogue ? buildGroups(catalogue, '').flatMap((g) => g.rows).find((r) => !r.disabled && sameTarget(r.target, target)) : null;
    setActiveKey(selected?.key ?? null);
    setOpen(true);
  }, [catalogue, target, setOpen]);

  // Ctrl/Cmd+K opens the picker from anywhere on the page.
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) inputRef.current?.focus();
        else openPicker();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, openPicker]);

  // Esc and clicks outside close it.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    const onMouseDown = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      close({ restoreFocus: false });
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !active) return;
    document.getElementById(optionId(active.key))?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active?.key]);

  const choose = (row) => {
    onSelect(row.target);
    close();
  };

  const move = (delta) => {
    if (!enabledRows.length) return;
    const index = enabledRows.findIndex((r) => r.key === active?.key);
    const next = Math.min(Math.max(index + delta, 0), enabledRows.length - 1);
    setActiveKey(enabledRows[next].key);
  };

  const onSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveKey(enabledRows[0]?.key ?? null);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveKey(enabledRows[enabledRows.length - 1]?.key ?? null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active) choose(active);
    }
  };

  const described = describeTarget(target, catalogue);
  const hasAnyModel = Boolean(catalogue?.nodes?.some((n) => n.models?.length));

  return (
    <div className="ai-chat__picker">
      <button
        ref={buttonRef}
        type="button"
        className="ai-chat__picker-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-keyshortcuts="Control+K Meta+K"
        title="Choose a model (Ctrl+K)"
        onClick={() => (open ? close() : openPicker())}
      >
        <span className="ai-chat__picker-model">{described ? described.model : 'Select a model'}</span>
        {described && <span className="ai-chat__picker-where">{described.where}</span>}
        <ChevronDownIcon size={16} />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="ai-chat__picker-panel"
          role="dialog"
          aria-label="Choose a model"
        >
          <div className="ai-chat__picker-search">
            <SearchIcon size={16} />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={active ? optionId(active.key) : undefined}
              aria-autocomplete="list"
              aria-label="Search models and nodes"
              placeholder="Search models or nodes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="ai-chat__icon-button"
              aria-label="Refresh models"
              title="Refresh models"
              onClick={onRefresh}
            >
              <RefreshIcon size={16} />
            </button>
          </div>

          <div id={listId} role="listbox" aria-label="Models" className="ai-chat__picker-list">
            {groups.map((group) => {
              const headerId = `${uid}-group-${group.key}`;
              return (
                <div
                  key={group.key}
                  role="group"
                  aria-labelledby={headerId}
                  className={`ai-chat__group${group.node?.status === 'OFFLINE' ? ' ai-chat__group--offline' : ''}`}
                >
                  {group.kind === 'auto' ? (
                    <div id={headerId} className="ai-chat__group-header">
                      <span className="ai-chat__group-name">Auto</span>
                      <span className="ai-chat__group-status">picks the best node for you</span>
                    </div>
                  ) : (
                    <NodeHeader id={headerId} node={group.node} />
                  )}
                  {group.rows.map((row) => (
                    <OptionRow
                      key={row.key}
                      id={optionId(row.key)}
                      row={row}
                      selected={sameTarget(row.target, target)}
                      active={active?.key === row.key}
                      onChoose={choose}
                      onHover={(r) => setActiveKey(r.key)}
                    />
                  ))}
                </div>
              );
            })}

            {!catalogue && loading && (
              <p className="ai-chat__picker-empty" role="status">Loading models…</p>
            )}
            {!catalogue && !loading && error && (
              <div className="ai-chat__picker-empty" role="alert">
                <p>Couldn&apos;t load models: {error}</p>
                <button type="button" className="ai-chat__button" onClick={onRefresh}>Try again</button>
              </div>
            )}
            {catalogue && !hasAnyModel && !query && (
              <p className="ai-chat__picker-empty">No models available. Check the Status tab to see which nodes are up.</p>
            )}
            {catalogue && (hasAnyModel || query) && groups.length === 0 && (
              <p className="ai-chat__picker-empty">No models or nodes match &ldquo;{query.trim()}&rdquo;.</p>
            )}
          </div>

          <div className="ai-chat__picker-footer">
            {catalogue && error ? (
              <span role="status">Showing the last list we got; refresh failed.</span>
            ) : (
              <span>↑↓ move · Enter select · Esc close</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
