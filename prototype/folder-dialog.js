import { escapeProperty as escape } from './property-editor.js';

export default class FolderDialog {
  constructor(root, options) {
    this.options = options; this.dialog = document.createElement('dialog'); this.dialog.className = 'b-folder-dialog';
    root.append(this.dialog);
    this.dialog.addEventListener('submit', async event => {
      event.preventDefault(); if (this.saving) return;
      const form = this.dialog.querySelector('form'), values = new FormData(form);
      this.saving = true; this.dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
      try {
        const result = await options.save({ mode: this.mode, id: this.id, folder: String(values.get('folder')), name: String(values.get('name') || '') });
        this.dialog.close(); options.done(result, this.mode);
      } catch (error) { const message = this.dialog.querySelector('[role=alert]'); message.textContent = error.message; message.hidden = false; }
      finally { this.saving = false; this.dialog.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
    });
    this.dialog.addEventListener('click', event => { if (event.target.closest('[data-cancel-folder]') && !this.saving) this.dialog.close(); });
    this.dialog.addEventListener('cancel', event => { if (this.saving) event.preventDefault(); });
  }
  show(mode, folder = '', id = null) {
    this.mode = mode; this.id = id;
    const move = mode === 'move', title = move ? 'Move page' : 'New folder';
    this.dialog.setAttribute('aria-label', title);
    this.dialog.innerHTML = `<form><h2>${title}</h2>${move ? '<p class="b-muted">The page keeps its database and properties. Markdown links will be updated.</p>' : `<label>Folder name<input name="name" aria-label="Folder name" required maxlength="120" autocomplete="off"></label>`}<label>${move ? 'Destination' : 'Inside'}<select name="folder" aria-label="${move ? 'Destination folder' : 'Parent folder'}">${['', ...this.options.folders()].map(path => `<option value="${escape(path)}" ${path === folder ? 'selected' : ''}>${escape(path || 'Workspace root')}</option>`).join('')}</select></label><p role="alert" class="b-issues" hidden></p><div class="b-actions"><button type="button" class="b-button" data-cancel-folder>Cancel</button><button type="submit" class="b-button b-primary">${move ? 'Move page' : 'Create folder'}</button></div></form>`;
    this.dialog.showModal(); this.dialog.querySelector('input,select').focus();
  }
}
