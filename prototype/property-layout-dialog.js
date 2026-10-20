import { escapeProperty as escape } from './property-editor.js';
import { propertyLayout } from './property-layout.js';

export default class PropertyLayoutDialog {
  constructor(root, options) {
    this.options = options;
    this.dialog = document.createElement('dialog'); this.dialog.className = 'b-layout-dialog';
    this.dialog.setAttribute('aria-label', 'Arrange properties'); root.append(this.dialog);
    this.dialog.addEventListener('click', event => {
      if (this.saving) return;
      if (event.target.closest('[data-cancel-layout]')) this.dialog.close();
      const move = event.target.closest('[data-layout-move]');
      if (move) this.move(move.dataset.layoutMove, move.dataset.group);
    });
    this.dialog.addEventListener('keydown', event => {
      const handle = event.target.closest('[data-layout-handle]');
      if (!handle || !event.altKey || this.saving || !event.key.startsWith('Arrow')) return;
      event.preventDefault();
      const id = handle.dataset.layoutHandle, group = this.group(id), index = this.layout[group].indexOf(id);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') this.move(id, event.key === 'ArrowLeft' ? 'important' : 'detail');
      else this.move(id, group, index + (event.key === 'ArrowUp' ? -1 : 1));
    });
    this.dialog.addEventListener('dragstart', event => {
      const handle = event.target.closest('[data-layout-handle]');
      if (!handle || this.saving) { event.preventDefault(); return; }
      this.dragging = handle.dataset.layoutHandle;
      event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', this.dragging);
    });
    this.dialog.addEventListener('dragover', event => {
      const group = event.target.closest('[data-layout-group]');
      if (!this.dragging || !group || this.saving) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'move';
      this.clearDrop(); group.dataset.dropActive = '';
    });
    this.dialog.addEventListener('drop', event => {
      const group = event.target.closest('[data-layout-group]');
      if (!this.dragging || !group || this.saving) return;
      event.preventDefault();
      const target = event.target.closest('[data-layout-field]');
      const remaining = this.layout[group.dataset.layoutGroup].filter(id => id !== this.dragging);
      let index = remaining.length;
      if (target && target.dataset.layoutField !== this.dragging) {
        const bounds = target.getBoundingClientRect();
        index = remaining.indexOf(target.dataset.layoutField) + Number(event.clientY > bounds.top + bounds.height / 2);
      }
      if (!target || target.dataset.layoutField !== this.dragging) this.move(this.dragging, group.dataset.layoutGroup, index);
      this.dragging = null; this.clearDrop();
    });
    this.dialog.addEventListener('dragend', () => { this.dragging = null; this.clearDrop(); });
    this.dialog.addEventListener('cancel', event => { if (this.saving) event.preventDefault(); });
    this.dialog.addEventListener('close', () => { this.dragging = null; root.querySelector('[data-arrange-properties]')?.focus(); });
    this.dialog.addEventListener('submit', event => { event.preventDefault(); this.save(); });
  }
  group(id) { return this.layout.important.includes(id) ? 'important' : 'detail'; }
  clearDrop() { this.dialog.querySelectorAll('[data-drop-active]').forEach(group => group.removeAttribute('data-drop-active')); }
  move(id, group, index = this.layout[group].length) {
    if (!this.fields.has(id) || !['important', 'detail'].includes(group) || this.required.includes(id)) return;
    for (const key of ['important', 'detail']) this.layout[key] = this.layout[key].filter(value => value !== id);
    this.layout[group].splice(Math.max(0, Math.min(index, this.layout[group].length)), 0, id);
    this.render(`${this.fields.get(id)} moved to ${group === 'important' ? 'Important' : 'Details'}.`);
    [...this.dialog.querySelectorAll('[data-layout-handle]')].find(handle => handle.dataset.layoutHandle === id)?.focus();
  }
  show(database) {
    const { required, important, detail } = propertyLayout(database);
    this.database = database.id; this.title = database.title; this.required = required;
    this.layout = { important, detail };
    this.fields = new Map([...database.fields.map(field => [field.id, field.name]), ['$color', 'Color'], ['$tags', 'Tags']]);
    this.render(); this.dialog.showModal();
  }
  render(message = '') {
    const rows = (group, ids) => ids.map(id => `<li data-layout-field="${escape(id)}">${group === 'required' ? '<span class="b-muted" aria-label="Required property">*</span>' : `<button type="button" draggable="true" data-layout-handle="${escape(id)}" aria-label="Reorder ${escape(this.fields.get(id))}" title="Drag to arrange · Alt+arrow keys">⠿</button>`}<span>${escape(this.fields.get(id))}</span>${group === 'required' ? '' : `<button type="button" class="b-layout-move" data-layout-move="${escape(id)}" data-group="${group === 'important' ? 'detail' : 'important'}" aria-label="Move ${escape(this.fields.get(id))} to ${group === 'important' ? 'Details' : 'Important'}" title="Move to ${group === 'important' ? 'Details' : 'Important'}">${group === 'important' ? '↓' : '↑'}</button>`}</li>`).join('');
    this.dialog.innerHTML = `<form><h2>Arrange properties</h2><p class="b-muted">For every page in ${escape(this.title)}. Drag to reorder or move between groups.</p>${this.required.length ? `<h3>Required</h3><p class="b-layout-hint">Always visible. Validation is unchanged.</p><ul class="b-layout-required">${rows('required', this.required)}</ul>` : ''}<h3>Important</h3><p class="b-layout-hint">Above the fold, including empty values.</p><ul data-layout-group="important" aria-label="Important properties">${rows('important', this.layout.important)}</ul><h3>Details</h3><p class="b-layout-hint">Under More, even when filled in.</p><ul data-layout-group="detail" aria-label="Detail properties">${rows('detail', this.layout.detail)}</ul><p class="b-layout-hint">Keyboard: Alt+↑/↓ reorders; Alt+←/→ changes group.</p><p class="b-visually-hidden" role="status">${escape(message)}</p><p role="alert" class="b-issues" hidden></p><div class="b-actions"><button type="button" class="b-button" data-cancel-layout>Cancel</button><button type="submit" class="b-button b-primary">Save layout</button></div></form>`;
  }
  async save() {
    if (this.saving) return;
    this.saving = true; this.dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
    try { await this.options.save(this.database, structuredClone(this.layout)); this.dialog.close(); }
    catch (error) { const alert = this.dialog.querySelector('[role=alert]'); alert.textContent = error.message; alert.hidden = false; }
    finally { this.saving = false; this.dialog.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
  }
}
