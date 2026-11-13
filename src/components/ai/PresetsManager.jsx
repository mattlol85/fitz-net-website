import React, { useMemo, useState } from 'react';
import Dialog from './Dialog';
import { MAX_PROMPT_CHARS } from './aiChatUtils';
import { PencilIcon, PlusIcon, TrashIcon } from './icons';
import '../../css/ai/settings.css';

const EMPTY_FORM = {
  name: '',
  description: '',
  model: '',
  nodeId: '',
  systemPrompt: '',
  temperature: '',
  numCtx: '',
  visibility: 'private',
  requiredPermission: '',
};

const toForm = (preset) => ({
  name: preset.name || '',
  description: preset.description || '',
  model: preset.model || '',
  nodeId: preset.nodeId || '',
  systemPrompt: preset.systemPrompt || '',
  temperature: preset.temperature ?? '',
  numCtx: preset.numCtx ?? '',
  visibility: preset.visibility || 'private',
  requiredPermission: preset.requiredPermission || '',
});

/** Client-side checks that mirror contract section 9, so most mistakes never reach the API. */
export function validatePreset(form) {
  const errors = {};
  const name = form.name.trim();
  if (name.length < 1 || name.length > 60) errors.name = 'Name must be 1 to 60 characters.';
  if (form.description.length > 200) errors.description = 'Description can be at most 200 characters.';
  if (form.systemPrompt.length > MAX_PROMPT_CHARS) errors.systemPrompt = `System prompt can be at most ${MAX_PROMPT_CHARS} characters.`;
  if (form.temperature !== '') {
    const t = Number(form.temperature);
    if (!Number.isFinite(t) || t < 0 || t > 2) errors.temperature = 'Temperature must be between 0 and 2.';
  }
  if (form.numCtx !== '') {
    const n = Number(form.numCtx);
    if (!Number.isInteger(n) || n < 512 || n > 131072) errors.numCtx = 'Context size must be a whole number from 512 to 131072.';
  }
  return errors;
}

export function toPayload(form, canShare) {
  const shared = canShare && form.visibility === 'shared';
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    model: form.model || null,
    nodeId: form.model && form.nodeId ? form.nodeId : null,
    systemPrompt: form.systemPrompt.trim() ? form.systemPrompt : null,
    temperature: form.temperature === '' ? null : Number(form.temperature),
    numCtx: form.numCtx === '' ? null : Number(form.numCtx),
    visibility: shared ? 'shared' : 'private',
    requiredPermission: shared && form.requiredPermission.trim() ? form.requiredPermission.trim() : null,
  };
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className="ai-chat__field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="ai-chat__field-hint">{hint}</p>}
      {error && (
        <p className="ai-chat__field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function PresetForm({ preset, catalogue, canShare, onSave, onCancel }) {
  const readOnly = Boolean(preset) && preset.editable === false;
  const [form, setForm] = useState(preset ? toForm(preset) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const errors = validatePreset(form);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const modelNames = useMemo(() => {
    const names = new Set((catalogue?.models || []).map((m) => m.name));
    (catalogue?.nodes || []).forEach((n) => n.models?.forEach((m) => names.add(m.name)));
    if (form.model) names.add(form.model);
    return [...names].sort();
  }, [catalogue, form.model]);

  const nodesWithModel = useMemo(
    () =>
      (catalogue?.nodes || []).filter((n) => n.models?.some((m) => m.name === form.model)),
    [catalogue, form.model]
  );

  const submit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setShowErrors(true);
    setServerError(null);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await onSave(toPayload(form, canShare), preset?.id);
    } catch (err) {
      setServerError(err.message || 'Could not save the preset.');
      setSaving(false);
    }
  };

  const shown = (field) => (showErrors ? errors[field] : undefined);

  return (
    <form className="ai-chat__preset-form" onSubmit={submit} noValidate>
      <h2 className="ai-chat__dialog-title">
        {preset ? (readOnly ? 'Preset (read only)' : 'Edit preset') : 'New preset'}
      </h2>
      {readOnly && (
        <p className="ai-chat__field-hint">
          This preset is shared and only an admin can change it.
        </p>
      )}
      <fieldset disabled={readOnly || saving} className="ai-chat__fieldset">
        <Field id="preset-name" label="Name" error={shown('name')}>
          <input id="preset-name" type="text" value={form.name} onChange={set('name')} maxLength={80} />
        </Field>
        <Field id="preset-description" label="Description" error={shown('description')}>
          <input id="preset-description" type="text" value={form.description} onChange={set('description')} />
        </Field>
        <Field id="preset-model" label="Model" hint="Pin a model, or leave on Any model to use whatever is selected.">
          <select id="preset-model" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value, nodeId: '' }))}>
            <option value="">Any model</option>
            {modelNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        {form.model && (
          <Field id="preset-node" label="Node">
            <select id="preset-node" value={form.nodeId} onChange={set('nodeId')}>
              <option value="">Auto</option>
              {nodesWithModel.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                  {n.status === 'OFFLINE' ? ' (offline)' : ''}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="preset-prompt" label="System prompt" error={shown('systemPrompt')}>
          <textarea id="preset-prompt" rows={5} value={form.systemPrompt} onChange={set('systemPrompt')} />
          <span className="ai-chat__counter">
            {form.systemPrompt.length} / {MAX_PROMPT_CHARS}
          </span>
        </Field>
        <div className="ai-chat__field-row">
          <Field id="preset-temperature" label="Temperature" error={shown('temperature')}>
            <input
              id="preset-temperature"
              type="number"
              min="0"
              max="2"
              step="0.1"
              placeholder="Model default"
              value={form.temperature}
              onChange={set('temperature')}
            />
          </Field>
          <Field id="preset-numctx" label="Context size" error={shown('numCtx')}>
            <input
              id="preset-numctx"
              type="number"
              min="512"
              max="131072"
              step="1"
              placeholder="Model default"
              value={form.numCtx}
              onChange={set('numCtx')}
            />
          </Field>
        </div>
        {canShare && (
          <>
            <Field id="preset-visibility" label="Visibility">
              <select id="preset-visibility" value={form.visibility} onChange={set('visibility')}>
                <option value="private">Private (only you)</option>
                <option value="shared">Shared</option>
              </select>
            </Field>
            {form.visibility === 'shared' && (
              <Field
                id="preset-permission"
                label="Required permission"
                hint="Leave empty to share with everyone who has AI access."
              >
                <input id="preset-permission" type="text" value={form.requiredPermission} onChange={set('requiredPermission')} />
              </Field>
            )}
          </>
        )}
      </fieldset>

      {serverError && (
        <p className="ai-chat__field-error" role="alert">
          {serverError}
        </p>
      )}
      <div className="ai-chat__form-buttons">
        <button type="button" className="ai-chat__button" onClick={onCancel}>
          {readOnly ? 'Back' : 'Cancel'}
        </button>
        {!readOnly && (
          <button type="submit" className="ai-chat__button ai-chat__button--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save preset'}
          </button>
        )}
      </div>
    </form>
  );
}

/** The presets manager: list, create, edit (or view, when read-only) and delete behind a second click. */
export default function PresetsManager({ presets, catalogue, canShare, onClose }) {
  const [view, setView] = useState({ name: 'list' });
  const [deletingId, setDeletingId] = useState(null);
  const [listError, setListError] = useState(null);

  const save = async (payload, id) => {
    await presets.save(payload, id);
    setView({ name: 'list' });
  };

  const confirmDelete = async (id) => {
    setListError(null);
    try {
      await presets.remove(id);
    } catch (err) {
      setListError(err.message || 'Could not delete the preset.');
    }
    setDeletingId(null);
  };

  return (
    <Dialog label="Presets" onClose={onClose} variant="modal" className="ai-chat__dialog--wide" showClose>
      {view.name === 'form' ? (
        <PresetForm
          preset={view.preset}
          catalogue={catalogue}
          canShare={canShare}
          onSave={save}
          onCancel={() => setView({ name: 'list' })}
        />
      ) : (
        <div className="ai-chat__preset-list">
          <div className="ai-chat__dialog-head">
            <h2 className="ai-chat__dialog-title">Presets</h2>
            <button type="button" className="ai-chat__button" onClick={() => setView({ name: 'form' })}>
              <PlusIcon size={14} /> New preset
            </button>
          </div>
          {presets.loading && <p className="ai-chat__field-hint" role="status">Loading presets…</p>}
          {presets.error && (
            <p className="ai-chat__field-error" role="alert">
              {presets.error}
            </p>
          )}
          {listError && (
            <p className="ai-chat__field-error" role="alert">
              {listError}
            </p>
          )}
          {!presets.loading && presets.items.length === 0 && (
            <p className="ai-chat__field-hint">No presets yet. A preset bundles a model, a system prompt and sampling settings.</p>
          )}
          <ul className="ai-chat__presets">
            {presets.items.map((preset) => (
              <li key={preset.id} className="ai-chat__preset">
                <div className="ai-chat__preset-main">
                  <div className="ai-chat__preset-title">
                    <span className="ai-chat__preset-name">{preset.name}</span>
                    <span className="ai-chat__badge">{preset.visibility === 'shared' ? 'Shared' : 'Private'}</span>
                    {preset.ownerUsername && <span className="ai-chat__badge">by {preset.ownerUsername}</span>}
                    {preset.editable === false && <span className="ai-chat__badge">Read only</span>}
                  </div>
                  {preset.description && <p className="ai-chat__preset-desc">{preset.description}</p>}
                  {preset.model && <span className="ai-chat__chip">{preset.model}</span>}
                </div>
                {deletingId === preset.id ? (
                  <div className="ai-chat__preset-actions" role="group" aria-label={`Delete ${preset.name}?`}>
                    <button type="button" className="ai-chat__button ai-chat__button--danger" onClick={() => confirmDelete(preset.id)}>
                      Confirm delete
                    </button>
                    <button type="button" className="ai-chat__button" onClick={() => setDeletingId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="ai-chat__preset-actions">
                    <button
                      type="button"
                      className="ai-chat__button"
                      aria-label={`${preset.editable === false ? 'View' : 'Edit'} ${preset.name}`}
                      onClick={() => setView({ name: 'form', preset })}
                    >
                      <PencilIcon size={14} /> {preset.editable === false ? 'View' : 'Edit'}
                    </button>
                    {preset.editable !== false && (
                      <button
                        type="button"
                        className="ai-chat__button"
                        aria-label={`Delete ${preset.name}`}
                        onClick={() => setDeletingId(preset.id)}
                      >
                        <TrashIcon size={14} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
