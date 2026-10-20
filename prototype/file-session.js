import BentoWorkspace from './workspace.js';
/* Desktop persistence is independent of the editor and browser-only sample mode. */
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
};
const signature = value => { const { issues, ...rest } = value; return JSON.stringify(canonical(rest)); };
class FileSession {
  constructor(api, callbacks, { storage, confirm = globalThis.confirm } = {}) {
    this.storage = storage; this.confirm = confirm;
    try { this.storage ??= globalThis.localStorage; } catch { /* Storage operations below report session-only drafts. */ }
    this.api = api; this.callbacks = callbacks; this.view = null; this.timer = null; this.saving = false; this.failed = false; this.dirty = false; this.draftAvailable = true;
  }
  async call(operation) {
    const result = await operation;
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }
  key() { return 'bento.desktop.draft.' + this.view.folder; }
  async open(operation) {
    if (this.saving) return this.callbacks.status('Wait for the current save to finish.');
    if (this.dirty && !this.confirm('Your unsaved draft will remain available in this app. Leave this workspace?')) return;
    clearTimeout(this.timer);
    try {
      const view = await this.call(operation());
      if (!view) return;
      this.view = view; this.failed = false; this.dirty = false;
      this.callbacks.activate(view);
      this.status();
    } catch (error) { this.callbacks.status(error.message); }
    finally { if (this.dirty && !this.failed && !this.view?.readOnly) this.timer = setTimeout(() => this.save(), 750); }
  }
  changed(workspace) {
    if (!this.view) return;
    this.dirty = signature(workspace) !== signature(this.view.workspace);
    clearTimeout(this.timer);
    if (!this.dirty) {
      if (this.saving || this.failed) this.keepDraft(workspace);
      else { try { this.storage.removeItem(this.key()); } catch { this.draftAvailable = false; } }
      this.status(); return;
    }
    this.keepDraft(workspace);
    if (!this.failed && !this.view.readOnly) this.timer = setTimeout(() => this.save(), 750);
    this.status();
  }
  keepDraft(workspace) {
    try { this.storage.setItem(this.key(), JSON.stringify({ base: signature(this.view.workspace), workspace })); this.draftAvailable = true; }
    catch { this.draftAvailable = false; }
  }
  status() {
    this.callbacks.status(this.saving ? 'Saving files…' : this.failed ? (this.draftAvailable ? 'Save stopped. Your draft is kept; review the error before reloading.' : 'Save stopped. Keep this window open; draft storage is unavailable.') : this.view.readOnly ? 'Workspace needs repair before saving.' : this.dirty ? (this.draftAvailable ? 'Unsaved changes · draft kept in this app' : 'Unsaved changes · draft storage unavailable') : 'Saved to workspace files');
    this.callbacks.controls?.(this);
  }
  save() {
    clearTimeout(this.timer);
    if (this.saving) return this.pendingSave;
    if (!this.view || this.view.readOnly || !this.dirty) return Promise.resolve();
    this.pendingSave = this.write(); return this.pendingSave;
  }
  async write() {
    this.saving = true; this.status();
    const requested = structuredClone(this.callbacks.workspace());
    try {
      const view = await this.call(this.api.save(requested));
      this.view = view; this.failed = false; this.callbacks.error('');
      this.dirty = signature(this.callbacks.workspace()) !== signature(requested);
      if (this.dirty) {
        this.keepDraft(this.callbacks.workspace());
        this.timer = setTimeout(() => this.save(), 750);
      } else { try { this.storage.removeItem(this.key()); } catch { this.draftAvailable = false; } }
    } catch (error) {
      this.failed = true;
      this.callbacks.error(error.message);
    } finally { this.saving = false; this.status(); }
  }
  async mutate(operation) {
    if (this.operating) return null;
    this.lastError = null; this.operating = true; this.callbacks.busy?.(true);
    try {
      if (!this.view || this.view.readOnly) throw new Error('Repair the workspace before organizing files.');
      await this.save();
      if (this.dirty) await this.save();
      if (this.dirty || this.failed) throw new Error('Save or recover your draft before organizing files.');
      const location = this.callbacks.location?.();
      this.callbacks.status('Organizing files…');
      const view = await this.call(operation());
      this.view = view; this.callbacks.activate({ ...view, location, mutation: true });
      return view;
    } catch (error) { this.lastError = error.message; this.callbacks.error(error.message); return null; }
    finally { this.operating = false; this.callbacks.busy?.(false); this.status(); }
  }
  hasDraft() { try { return !!this.storage.getItem(this.key()); } catch { return false; } }
  restore() {
    try {
      const draft = JSON.parse(this.storage.getItem(this.key()));
      if (draft.base !== signature(this.view.workspace)) throw new Error('Files changed since this draft was written. Download the draft to compare it; automatic restoration would overwrite newer work.');
      BentoWorkspace.assertWorkspace(draft.workspace);
      this.callbacks.activate({ ...this.view, workspace: draft.workspace });
      this.dirty = true; this.failed = true; this.status();
    } catch (error) { this.callbacks.error(error.message); }
  }
  downloadDraft() {
    const raw = this.storage.getItem(this.key());
    if (!raw) return;
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'bento-unsaved-draft.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export default FileSession;
