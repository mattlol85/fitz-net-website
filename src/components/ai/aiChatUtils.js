/** Pure helpers shared by the Matt-GPT chat components and hooks. */

/** 8192 -> "8K", 131072 -> "128K", 1048576 -> "1M". Returns null when unknown. */
export function formatContext(tokens) {
  if (!tokens) return null;
  if (tokens >= 1024 * 1024) return `${Math.round((tokens / (1024 * 1024)) * 10) / 10}M`;
  if (tokens >= 1024) return `${Math.round(tokens / 1024)}K`;
  return String(tokens);
}

const toGb = (mb) => (mb / 1024).toFixed(1);

/** { totalMb, usedMb } -> "9.0 / 16.0 GB", "16.0 GB total", or null when nothing is known. */
export function formatVram(vram) {
  if (!vram?.totalMb) return null;
  if (vram.usedMb == null) return `${toGb(vram.totalMb)} GB total`;
  return `${toGb(vram.usedMb)} / ${toGb(vram.totalMb)} GB`;
}

export function statusLabel(status) {
  switch (status) {
    case 'ONLINE':
      return 'Online';
    case 'BUSY':
      return 'Busy';
    case 'OFFLINE':
      return 'Offline';
    default:
      return status || 'Unknown';
  }
}

export const sameTarget = (a, b) =>
  Boolean(a && b) && a.model === b.model && (a.nodeId ?? null) === (b.nodeId ?? null);

/** True when the catalogue lists the model on a node that is not OFFLINE. */
function modelAvailable(catalogue, model) {
  return Boolean(catalogue?.models?.some((m) => m.name === model));
}

/**
 * The target a new chat starts on: the user's last pick when the catalogue still has that model
 * (falling back to Auto if the pinned node went away), else the first model that is already
 * loaded, else the first model. Null while the catalogue is unknown or empty.
 */
export function resolveDefaultTarget(lastTarget, catalogue) {
  const models = catalogue?.models;
  if (!models?.length) return null;

  if (lastTarget?.model && modelAvailable(catalogue, lastTarget.model)) {
    const node = lastTarget.nodeId && catalogue.nodes?.find((n) => n.id === lastTarget.nodeId);
    const nodeUsable =
      node && node.status !== 'OFFLINE' && node.models?.some((m) => m.name === lastTarget.model);
    return { model: lastTarget.model, nodeId: nodeUsable ? lastTarget.nodeId : null };
  }

  const pick = models.find((m) => m.loadedOn?.length) || models[0];
  return { model: pick.name, nodeId: null };
}

/** { model, where } for the picker button: where is "Auto" or the node's name. */
export function describeTarget(target, catalogue) {
  if (!target?.model) return null;
  if (!target.nodeId) return { model: target.model, where: 'Auto' };
  const node = catalogue?.nodes?.find((n) => n.id === target.nodeId);
  return { model: target.model, where: node?.name || 'Unknown node' };
}

/** Case-insensitive substring match; an empty needle matches everything. */
export const matchesQuery = (needle, ...haystacks) => {
  const q = needle.trim().toLowerCase();
  return !q || haystacks.some((h) => (h || '').toLowerCase().includes(q));
};

export function formatElapsed(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/** "420 ms", "5.2 s", "2m 5s". Used by the per-reply stats. */
export function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

/** The value when it is a finite number, else null (so missing stats are omitted, never 0 or NaN). */
export const finiteNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * The one-click failover choices for a model, derived from the catalogue: nodes that are not
 * OFFLINE and list the model, except `excludeNodeId`. Warm nodes first, then by name.
 */
export function deriveAlternatives(catalogue, model, excludeNodeId = null) {
  if (!catalogue?.nodes || !model) return [];
  return catalogue.nodes
    .filter((n) => n.status !== 'OFFLINE' && n.id !== excludeNodeId)
    .map((n) => ({ node: n, entry: n.models?.find((m) => m.name === model) }))
    .filter(({ entry }) => entry)
    .map(({ node, entry }) => ({
      nodeId: node.id,
      nodeName: node.name,
      model,
      loaded: Boolean(entry.loaded),
      status: node.status,
    }))
    .sort((a, b) => Number(b.loaded) - Number(a.loaded) || a.nodeName.localeCompare(b.nodeName));
}

/** Error codes the API sends `alternatives` for. */
export const FAILOVER_CODES = ['NODE_OFFLINE', 'MODEL_NOT_ON_NODE', 'NO_NODE_AVAILABLE', 'NODE_UNREACHABLE'];

/** Normalises a ContextUsage or a `meta.context` into what the banner and ring need. */
export function toContextInfo(source, extra = {}) {
  if (!source) return null;
  return {
    model: source.model ?? extra.model ?? null,
    contextLength: source.contextLength ?? extra.contextLength ?? null,
    usedTokens: source.usedTokens ?? source.promptTokensEstimate ?? null,
    trimmedCount: source.trimmedCount ?? 0,
    summaryActive: Boolean(source.summaryActive),
  };
}
