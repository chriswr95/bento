import { searchQuickOpen } from './quick-open-search.js';
import { escapeProperty as escape } from './property-editor.js';
import { validColor } from './colors.js';
export default class QuickOpen {
  constructor(root, options) {
    this.options = options;
    this.dialog = document.createElement('dialog'); this.dialog.className = 'b-quick-open'; this.dialog.setAttribute('aria-label', 'Quick open');
    this.dialog.innerHTML = `<div class="b-quick-search"><input type="search" role="combobox" aria-label="Search pages and commands" aria-autocomplete="list" aria-expanded="false" aria-controls="b-quick-results" placeholder="Search pages or commands…" autocomplete="off" spellcheck="false"><button type="button" data-close-quick aria-label="Close quick open" title="Escape">×</button></div><div id="b-quick-results" class="b-quick-results" role="listbox" aria-label="Pages and commands"></div><p class="b-quick-status" role="status" aria-live="polite"></p>`;
    root.append(this.dialog);
    this.input = this.dialog.querySelector('input'); this.list = this.dialog.querySelector('[role=listbox]'); this.status = this.dialog.querySelector('[role=status]');
    this.input.addEventListener('input', () => { if (!this.composing) this.update(); });
    this.input.addEventListener('compositionstart', () => { this.composing = true; });
    this.input.addEventListener('compositionend', () => { this.composing = false; this.update(); });
    this.dialog.addEventListener('keydown', event => this.keydown(event));
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); if (!this.composing) this.close(); });
    this.dialog.addEventListener('click', event => {
      const option = event.target.closest('[data-quick-option]');
      if (option) this.activate(Number(option.dataset.quickOption));
      else if (event.target.closest('[data-close-quick]')) this.close();
      else if (event.target === this.dialog) {
        const box = this.dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) this.close();
      }
    });
    this.list.addEventListener('mousedown', event => { if (event.target.closest('[role=option]')) event.preventDefault(); });
  }
  get open() { return this.dialog.open; }
  toggle() { if (this.open) this.close(); else this.show(); }
  show() {
    this.entries = this.options.entries(); this.restore = this.options.capture?.();
    this.input.value = ''; this.composing = false; this.update();
    this.input.setAttribute('aria-expanded', 'true'); this.dialog.showModal(); this.input.focus();
  }
  close() {
    if (!this.open) return;
    this.dialog.close(); this.input.setAttribute('aria-expanded', 'false');
    const restore = this.restore; this.restore = null; restore?.();
  }
  update() {
    this.results = searchQuickOpen(this.entries, this.input.value); this.index = this.results.length ? 0 : -1;
    this.list.innerHTML = this.results.map((entry, index) => `<div id="b-quick-option-${index}" role="option" data-quick-option="${index}" data-quick-kind="${entry.kind}" aria-selected="false"><span class="b-quick-icon ${entry.kind === 'page' ? 'b-color-dot' : ''}" ${validColor(entry.color) ? `data-color="${entry.color}"` : ''} aria-hidden="true">${entry.kind === 'command' ? '›' : ''}</span><span class="b-quick-label"><span class="b-quick-title">${escape(entry.title)}</span><span class="b-quick-detail">${escape(entry.detail || '')}</span></span>${entry.shortcut ? `<kbd>${escape(entry.shortcut)}</kbd>` : `<span class="b-quick-kind">${escape(entry.kind === 'command' ? 'Command' : entry.type || 'Page')}</span>`}</div>`).join('');
    this.status.textContent = this.results.length ? '↑ ↓ to move · Enter to open · Escape to close · > commands' : 'No matching pages or commands.';
    this.select(this.index);
  }
  select(index) {
    if (!this.results.length) { this.input.removeAttribute('aria-activedescendant'); return; }
    this.index = (index + this.results.length) % this.results.length;
    this.list.querySelectorAll('[role=option]').forEach((option, position) => option.setAttribute('aria-selected', String(position === this.index)));
    const active = this.list.children[this.index];
    this.input.setAttribute('aria-activedescendant', active.id);
    if (this.open) active.scrollIntoView({ block: 'nearest' });
  }
  keydown(event) {
    if (event.isComposing || this.composing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); this.select(this.index + (event.key === 'ArrowDown' ? 1 : -1)); }
    if (event.key === 'Enter' && event.target === this.input) { event.preventDefault(); this.activate(this.index); }
  }
  activate(index) {
    if (this.composing || !this.results[index]) return;
    const entry = this.results[index]; this.close();
    try { Promise.resolve(this.options.run(entry)).catch(error => this.options.error?.(error.message)); }
    catch (error) { this.options.error?.(error.message); }
  }
}
