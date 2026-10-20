import { matchingProperties, microPatch, valueChoices } from './micro-syntax.js';
import { escapeProperty as escape } from './property-editor.js';
import { nextDate } from './due-date-picker.js';

// Host adapters supply a query/range, geometry, context and one validated apply.
// Both text inputs and the Markdown editor use this exact two-stage picker.
export default class MicroPropertyPicker {
  constructor(root, options) {
    this.options = options; this.host = options.host; this.index = 0;
    this.menu = document.createElement('div'); this.menu.className = 'b-micro-picker'; this.menu.hidden = true;
    this.menu.id = 'b-micro-' + crypto.randomUUID(); root.append(this.menu);
    this.menu.addEventListener('mousedown', event => { if (event.target.closest('[data-micro-option]')) event.preventDefault(); });
    this.menu.addEventListener('click', event => {
      const option = event.target.closest('[data-micro-option]');
      if (option) this.choose(Number(option.dataset.microOption));
      if (event.target.closest('[data-micro-cancel]')) this.close(true);
      if (event.target.closest('[data-micro-apply]')) this.apply();
      const date = event.target.closest('[data-micro-date]');
      if (date) { this.menu.querySelector('[data-micro-value]').value = date.dataset.microDate === 'today' ? options.today() : nextDate(options.today()); this.apply(); }
    });
    this.menu.addEventListener('input', event => { if (!event.isComposing && event.target.matches('[data-micro-search]')) this.filterChoices(event.target.value); });
    this.menu.addEventListener('compositionend', event => { if (event.target.matches('[data-micro-search]')) this.filterChoices(event.target.value); });
    this.menu.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(true); }
      else if (event.key === 'Enter' && event.target.tagName !== 'BUTTON' && (event.target.tagName !== 'TEXTAREA' || event.ctrlKey || event.metaKey)) { event.preventDefault(); event.stopPropagation(); this.apply(); }
      else if (event.target.matches('[data-micro-search]') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault(); const select = this.menu.querySelector('select'); if (select?.options.length) { select.focus(); select.selectedIndex = [...select.options].findIndex(option => !option.hidden && option.value !== ''); }
      }
    });
    this.outside = event => { if (!this.menu.contains(event.target) && (!this.host.contains(event.target) || this.stage === 'value')) this.close(); };
    this.blur = () => setTimeout(() => { if (!this.destroyed && !this.host.contains(document.activeElement) && !this.menu.contains(document.activeElement)) this.close(); }, 0);
    this.reposition = () => {
      if (this.menu.hidden) return;
      try {
        const anchor = options.rect(this.context);
        if (!anchor || anchor.top !== this.anchor?.top || anchor.left !== this.anchor?.left) this.close();
      } catch { this.close(); }
    };
    document.addEventListener('pointerdown', this.outside); this.host.addEventListener('blur', this.blur);
    window.addEventListener('resize', this.reposition); window.addEventListener('scroll', this.reposition, true);
  }
  get active() { return !this.menu.hidden; }
  update() {
    if (this.stage === 'value') return;
    const context = this.options.query(), key = context && JSON.stringify([context.from, context.to, context.text, context.target]);
    if (this.dismissed !== key) this.dismissed = null;
    if (!context || key === this.dismissed) { this.close(); return; }
    this.context = context; this.key = key; this.stage = 'properties';
    this.results = matchingProperties(this.options.fields(context), context.text); this.index = 0;
    this.menu.setAttribute('role', 'listbox'); this.menu.setAttribute('aria-label', 'Properties');
    this.menu.innerHTML = this.results.map((field, index) => `<div role="option" id="${this.menu.id}-${index}" data-micro-option="${index}"><span>${escape(field.name)}${field.required ? ' *' : ''}</span><small>${escape(field.type)}</small></div>`).join('') || '<p class="b-muted">No matching properties</p>';
    this.menu.hidden = false; this.select(0); this.place();
    this.host.setAttribute('aria-controls', this.menu.id);
  }
  select(index) {
    if (!this.results.length) { this.host.removeAttribute('aria-activedescendant'); return; }
    this.index = (index + this.results.length) % this.results.length;
    this.menu.querySelectorAll('[role=option]').forEach((option, at) => option.setAttribute('aria-selected', String(at === this.index)));
    this.host.setAttribute('aria-activedescendant', `${this.menu.id}-${this.index}`);
    this.menu.children[this.index]?.scrollIntoView({ block: 'nearest' });
  }
  keydown(event) {
    if (!this.active || this.stage !== 'properties' || event.isComposing) return false;
    if (event.key === 'Escape') { this.dismissed = this.key; this.close(); }
    else if (['ArrowDown', 'ArrowUp'].includes(event.key)) this.select(this.index + (event.key === 'ArrowDown' ? 1 : -1));
    else if (['Enter', 'Tab'].includes(event.key) && this.results.length) this.choose(this.index);
    else if (event.key === 'Enter') { /* A failed property search must not submit the entry. */ }
    else return false;
    event.preventDefault(); event.stopPropagation(); return true;
  }
  choose(index) {
    const field = this.results[index]; if (!field) return;
    this.field = field; this.stage = 'value';
    this.host.removeAttribute('aria-activedescendant');
    const current = this.options.value(this.context, field), choices = valueChoices(this.options.workspace(), field, current);
    const many = field.type === 'multi-select' || field.type === 'relation' && field.cardinality === 'many';
    const choice = ['select', 'status', 'relation', 'multi-select', 'boolean', 'color'].includes(field.type);
    const label = `aria-label="${escape(field.name)}" data-micro-value`;
    const value = choice ? `${choices.length > 6 || field.type === 'relation' ? `<input type="search" data-micro-search aria-label="Search ${escape(field.name)}" placeholder="Search…" autocomplete="off">` : ''}<select ${label} ${many ? 'multiple size="5"' : 'size="' + Math.min(6, Math.max(2, choices.length + 1)) + '"'}>${!field.required && !many ? '<option value="">Not set</option>' : ''}${choices.map(option => `<option value="${escape(option.id)}" ${(Array.isArray(current) ? current : [String(current)]).includes(option.id) ? 'selected' : ''}>${escape(option.name)}</option>`).join('')}</select>`
      : field.type === 'tags' ? `<textarea ${label} rows="3" placeholder="One tag per line">${escape((current || []).join('\n'))}</textarea><small>One tag per line · Cmd/Ctrl+Enter to apply</small>`
      : `<input ${label} type="${field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}" ${field.required ? 'required' : ''} ${field.type === 'number' ? 'step="any"' : ''} value="${escape(current ?? '')}" autocomplete="off">`;
    this.menu.setAttribute('role', 'dialog'); this.menu.setAttribute('aria-label', `Set ${field.name}`);
    this.menu.innerHTML = `<strong>${escape(field.name)}</strong>${value}${field.type === 'date' ? '<div class="b-micro-dates"><button type="button" data-micro-date="today">Today</button><button type="button" data-micro-date="tomorrow">Tomorrow</button></div>' : ''}<p class="b-issues" role="alert" hidden></p><div class="b-micro-actions"><button type="button" data-micro-cancel>Cancel</button><button type="button" data-micro-apply>Apply</button></div>`;
    this.choices = choices; this.place(); this.menu.querySelector('input,select,textarea')?.focus();
  }
  edit(context, field) {
    this.context = context; this.results = [field]; this.menu.hidden = false;
    this.choose(0);
  }
  filterChoices(query) {
    const select = this.menu.querySelector('select'), selected = new Set([...select.selectedOptions].map(option => option.value));
    for (const option of select.options) option.hidden = option.value !== '' && !this.choices.find(choice => choice.id === option.value)?.name.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    for (const option of select.options) option.selected = selected.has(option.value);
    if (!select.multiple && query) select.selectedIndex = [...select.options].findIndex(option => !option.hidden && option.value !== '');
  }
  apply() {
    try {
      const control = this.menu.querySelector('[data-micro-value]');
      const search = this.menu.querySelector('[data-micro-search]');
      if (search?.value && ![...control.options].some(option => !option.hidden && option.value !== '')) throw new Error(`No matching ${this.field.name}.`);
      if (control.multiple && search?.value) {
        const first = [...control.options].find(option => !option.hidden && option.value !== '');
        if (first) first.selected = true;
      }
      if (!control.checkValidity()) throw new Error(`Enter a valid ${this.field.name}.`);
      const raw = control.multiple ? [...control.selectedOptions].map(option => option.value) : control.value;
      this.options.apply(this.context, this.field, microPatch(this.field, raw));
      this.close(true);
    } catch (error) { const panel = this.menu.querySelector('[role=alert]'); panel.hidden = false; panel.textContent = error.message; }
  }
  place() {
    const rect = this.options.rect(this.context); if (!rect) { this.close(); return; }
    const box = this.menu.getBoundingClientRect(); this.anchor = { left: rect.left, top: rect.top };
    this.menu.style.left = Math.max(8, Math.min(rect.left, innerWidth - box.width - 8)) + 'px';
    this.menu.style.top = Math.max(8, Math.min(rect.bottom + 4, innerHeight - box.height - 8)) + 'px';
  }
  close(focus = false) {
    if (focus) this.dismissed = this.key;
    this.menu.hidden = true; this.stage = null;
    if (this.host.getAttribute('aria-controls') === this.menu.id) { this.host.removeAttribute('aria-controls'); this.host.removeAttribute('aria-activedescendant'); }
    if (focus) this.options.focus();
  }
  destroy() {
    this.destroyed = true; this.close(); this.menu.remove(); document.removeEventListener('pointerdown', this.outside); this.host.removeEventListener('blur', this.blur);
    window.removeEventListener('resize', this.reposition); window.removeEventListener('scroll', this.reposition, true);
  }
}
