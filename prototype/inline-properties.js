import { colorLabel, recordColor, tagColor, automaticColor, colorPicker } from './colors.js';
import { propertyChoices, propertyValue, escapeProperty } from './property-editor.js';
const escape = escapeProperty;
const empty = value => value == null || value === '' || Array.isArray(value) && value.length === 0;

export default class InlineProperties {
  constructor(element, options) {
    this.element = element; this.options = options; this.active = null;
    let expanded = true;
    try { if (options.disclosureKey) expanded = localStorage.getItem(options.disclosureKey) !== 'false'; } catch { /* Disclosure still works without local storage. */ }
    element.innerHTML = `<details class="b-properties-disclosure" data-properties-disclosure ${expanded ? 'open' : ''}><summary><span class="b-properties-chevron" aria-hidden="true"></span>Properties</summary><div data-properties-content></div></details>`;
    this.disclosure = element.querySelector('[data-properties-disclosure]');
    this.content = element.querySelector('[data-properties-content]');
    this.disclosure.addEventListener('toggle', () => {
      if (this.destroyed || !options.disclosureKey) return;
      try { localStorage.setItem(options.disclosureKey, String(this.disclosure.open)); } catch { /* Keep the session preference. */ }
    });
    this.render();
    element.addEventListener('click', event => this.click(event));
    element.addEventListener('keydown', event => this.keydown(event));
    element.addEventListener('change', event => {
      if (event.target.matches('select,input[type=radio]')) this.commit(true);
      if (event.target.matches('[data-completed]')) {
        if (this.commit() && this.apply({ completed: event.target.checked })) this.render();
        else event.target.checked = this.options.completed();
      }
    });
    element.addEventListener('input', event => {
      if (event.target.matches('[data-search]')) {
        const query = event.target.value.toLocaleLowerCase();
        this.active.panel.querySelectorAll('[data-choice-label]').forEach(label => { label.hidden = !label.textContent.toLocaleLowerCase().includes(query); });
      }
    });
    element.addEventListener('focusout', event => {
      const active = this.active;
      if (active && event.relatedTarget && !element.contains(event.relatedTarget)) { this.commit(); return; }
      setTimeout(() => { if (!this.destroyed && active === this.active && active && !active.panel.contains(document.activeElement)) this.commit(); }, 0);
    });
  }
  fields() {
    const record = this.options.record();
    return [ ...(this.options.hideTitle ? [] : [{ id: '$title', name: 'Page title', type: 'text', required: true, value: record.title }]),
      { id: '$color', name: 'Color', type: 'color', value: record.color || 'automatic' },
      ...(this.options.workspace().databases[record.database]?.fields || []).map(field => ({ ...field, value: record.properties[field.id] })),
      { id: '$tags', name: 'Tags', type: 'tags', value: record.tags } ];
  }
  display(field) {
    if (field.type === 'color') return `<span class="b-property-chip" data-color="${recordColor(this.options.record())}">${field.value === 'automatic' ? 'Automatic' : colorLabel(field.value)}</span>`;
    if (empty(field.value)) return '<span class="b-muted">Empty</span>';
    const values = Array.isArray(field.value) ? field.value : [field.value];
    const choices = ['relation', 'select', 'multi-select', 'status'].includes(field.type) ? propertyChoices(this.options.workspace(), field, field.value) : null;
    return values.map(value => {
      const label = choices ? choices.find(option => option.id === value)?.name || 'Unavailable' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : value;
      const option = choices?.find(option => option.id === value);
      const color = field.type === 'tags' ? tagColor(this.options.workspace(), value) : field.type === 'relation' ? recordColor(this.options.workspace().records[value]) : option?.color || (field.type === 'status' ? ({ complete: 'green', 'in-progress': 'blue', 'not-started': 'orange' }[option?.group] || automaticColor(value)) : automaticColor(value));
      return `<span class="${['tags', 'select', 'status', 'multi-select', 'relation'].includes(field.type) ? 'b-property-chip' : ''}" ${['tags', 'select', 'status', 'multi-select', 'relation'].includes(field.type) ? `data-color="${color}"` : ''}>${escape(label)}</span>`;
    }).join(' ');
  }
  row(field) {
    return `<div class="b-inline-property" data-property-row="${escape(field.id)}"><span class="b-property-label">${escape(field.name)}${field.required ? '<span aria-label="required"> *</span>' : ''}</span><div class="b-property-value"><button type="button" data-edit-property="${escape(field.id)}" aria-label="Edit ${escape(field.name)}" ${this.options.readOnly || field.unavailable ? 'disabled' : ''}>${this.display(field)}</button>${field.unavailable ? '<span class="b-property-hint">Target database unavailable; values retained.</span>' : ''}<div data-property-panel hidden></div><p class="b-issues" data-inline-error role="alert" hidden></p></div></div>`;
  }
  render() {
    const focused = this.element.contains(document.activeElement) ? document.activeElement : null;
    const focusId = focused?.dataset.editProperty;
    const completedFocus = focused?.matches('[data-completed]');
    const moreFocus = focused?.matches('[data-more-properties]>summary');
    const expanded = this.element.querySelector('[data-more-properties]')?.open;
    const fields = this.fields(), visible = fields.filter(field => field.required || !empty(field.value)), hidden = fields.filter(field => !field.required && empty(field.value));
    this.content.innerHTML = `<div class="b-inline-properties" aria-label="Page properties">${this.options.completed ? `<label class="b-inline-completed"><input type="checkbox" data-completed aria-label="Completed" ${this.options.completed() ? 'checked' : ''} ${this.options.readOnly ? 'disabled' : ''}>Completed</label>` : ''}${visible.map(field => this.row(field)).join('')}${hidden.length ? `<details data-more-properties ${expanded ? 'open' : ''}><summary>More properties <span class="b-muted">${hidden.length}</span></summary>${hidden.map(field => this.row(field)).join('')}</details>` : ''}</div>`;
    if (focusId) [...this.element.querySelectorAll('[data-edit-property]')].find(button => button.dataset.editProperty === focusId)?.focus();
    else if (completedFocus) this.element.querySelector('[data-completed]')?.focus();
    else if (moreFocus) this.element.querySelector('[data-more-properties]>summary')?.focus();
  }
  control(field) {
    if (field.type === 'color') return colorPicker(this.options.record().color, 'data-pick-document-color');
    const label = `aria-label="${escape(field.name)}"`;
    if (field.type === 'tags') return `<div class="b-tag-editor">${field.value.map((tag, index) => `<span class="b-property-chip" data-color="${tagColor(this.options.workspace(), tag)}"><button type="button" class="b-tag-color-button" data-color-tag="${escape(tag)}" aria-label="Color tag ${escape(tag)}" title="Change tag color"><span class="b-color-dot" aria-hidden="true"></span></button>${escape(tag)}<button type="button" data-remove-tag="${index}" aria-label="Remove tag ${escape(tag)}">×</button></span>`).join('')}<input ${label} data-tag-input placeholder="Add a tag" autocomplete="off"><span class="b-property-hint">Enter to add</span></div>`;
    if (field.type === 'relation' || field.type === 'multi-select') {
      const many = field.type === 'multi-select' || field.cardinality === 'many';
      const values = Array.isArray(field.value) ? field.value : [field.value];
      return `<div class="b-property-picker"><input type="search" data-search aria-label="Search ${escape(field.name)}" placeholder="Search…" autocomplete="off"><fieldset aria-label="${escape(field.name)}"><legend class="b-visually-hidden">${escape(field.name)}</legend>${!many && !field.required ? '<label data-choice-label><input type="radio" name="property-choice" value="">Not set</label>' : ''}${propertyChoices(this.options.workspace(), field, field.value).map(option => `<label data-choice-label><input type="${many ? 'checkbox' : 'radio'}" name="property-choice" value="${escape(option.id)}" ${values.includes(option.id) ? 'checked' : ''}><span class="b-color-dot" data-color="${field.type === 'relation' ? recordColor(this.options.workspace().records[option.id]) : option.color || automaticColor(option.id)}" aria-hidden="true"></span>${escape(option.name)}</label>`).join('') || '<span class="b-muted">No choices available</span>'}</fieldset><span class="b-property-hint">Enter to apply · Escape to cancel</span></div>`;
    }
    if (['select', 'status', 'boolean'].includes(field.type)) {
      const choices = field.type === 'boolean' ? [{ id: 'true', name: 'Yes' }, { id: 'false', name: 'No' }] : field.options;
      return `<select ${label}>${!field.required ? '<option value="">Not set</option>' : ''}${choices.map(option => `<option value="${escape(option.id)}" ${String(field.value) === option.id ? 'selected' : ''}>${escape(option.name)}</option>`).join('')}</select>`;
    }
    return `<input ${label} type="${field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}" value="${escape(field.value ?? '')}" ${field.required ? 'required' : ''} ${field.type === 'number' ? 'step="any"' : ''} ${field.id === '$title' ? 'maxlength="200"' : ''}>`;
  }
  open(id) {
    if (this.options.readOnly || !this.commit()) return;
    const field = this.fields().find(field => field.id === id);
    if (!field || field.unavailable) return;
    const row = [...this.element.querySelectorAll('[data-property-row]')].find(row => row.dataset.propertyRow === id);
    const panel = row.querySelector('[data-property-panel]');
    row.querySelector('[data-edit-property]').hidden = true;
    panel.hidden = false; panel.innerHTML = this.control(field);
    this.active = { field, row, panel };
    const input = panel.querySelector('input,select,button'); input?.focus(); if (input?.type === 'text') input.select();
  }
  click(event) {
    if (event.target.closest('[data-properties-disclosure]>summary')) {
      if (!this.commit()) {
        event.preventDefault();
        this.active?.panel.querySelector('[aria-invalid="true"]')?.focus();
      }
      return;
    }
    const documentColor = event.target.closest('[data-pick-document-color]');
    if (documentColor) {
      if (this.apply({ color: documentColor.dataset.pickDocumentColor === 'automatic' ? null : documentColor.dataset.pickDocumentColor })) { this.close(); this.render(); this.element.querySelector('[data-edit-property="$color"]').focus(); }
      return;
    }
    const tagButton = event.target.closest('[data-color-tag]');
    if (tagButton && this.active) {
      this.active.panel.querySelector('[data-tag-palette]')?.remove();
      this.colorTag = tagButton.dataset.colorTag;
      const selected = this.options.workspace().tagColors?.[this.colorTag];
      this.active.panel.insertAdjacentHTML('beforeend', `<div data-tag-palette>${colorPicker(selected, 'data-pick-tag-color', 'Tag color')}</div>`);
      this.active.panel.querySelector('[data-tag-palette] button').focus(); return;
    }
    const tagChoice = event.target.closest('[data-pick-tag-color]');
    if (tagChoice && this.active) {
      try {
        const pending = this.active.panel.querySelector('[data-tag-input]').value;
        this.options.tagColor(this.colorTag, tagChoice.dataset.pickTagColor === 'automatic' ? null : tagChoice.dataset.pickTagColor);
        this.active = null; this.render(); this.open('$tags'); this.active.panel.querySelector('[data-tag-input]').value = pending;
      } catch (error) { this.error(error.message); }
      return;
    }
    const edit = event.target.closest('[data-edit-property]');
    if (edit) { this.open(edit.dataset.editProperty); return; }
    const remove = event.target.closest('[data-remove-tag]');
    if (remove && this.active) this.tags(this.active.field.value.filter((_tag, index) => index !== Number(remove.dataset.removeTag)));
  }
  keydown(event) {
    if (!this.active) return;
    if (event.isComposing) return;
    if (event.key === 'Escape' && this.active.panel.querySelector('[data-tag-palette]')) {
      event.preventDefault(); event.stopPropagation(); this.active.panel.querySelector('[data-tag-palette]').remove();
      [...this.active.panel.querySelectorAll('[data-color-tag]')].find(button => button.dataset.colorTag === this.colorTag)?.focus(); return;
    }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(true); }
    else if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') { event.preventDefault(); if (this.active.field.type === 'tags') this.addTag(); else this.commit(true); }
    else if (event.key === 'Backspace' && event.target.matches('[data-tag-input]') && !event.target.value) {
      event.preventDefault(); this.tags(this.active.field.value.slice(0, -1));
    }
  }
  close(focus = false) {
    const active = this.active; if (!active) return;
    this.active = null; active.panel.hidden = true; active.panel.innerHTML = '';
    const button = active.row.querySelector('[data-edit-property]'); button.hidden = false;
    active.row.querySelector('[data-inline-error]').hidden = true;
    if (focus) button.focus();
  }
  error(message) {
    const panel = this.active?.row.querySelector('[data-inline-error]');
    if (panel) {
      panel.textContent = message; panel.hidden = false;
      panel.id = 'b-property-error-' + this.active.field.id.replace(/[^a-zA-Z0-9_-]/g, '');
      this.active.panel.querySelectorAll('input,select').forEach(control => { control.setAttribute('aria-invalid', 'true'); control.setAttribute('aria-errormessage', panel.id); });
    }
    else this.options.error?.(message);
  }
  apply(patch) {
    if (this.options.readOnly) return false;
    try { this.options.change(patch); return true; }
    catch (error) { this.error(error.message); return false; }
  }
  tags(tags) {
    if (!this.apply({ tags: [...new Set(tags)] })) return false;
    const id = this.active.field.id;
    this.active = null; this.render(); this.open(id); return true;
  }
  addTag() {
    const input = this.active.panel.querySelector('[data-tag-input]'); const tag = input.value.trim();
    if (!tag) return true;
    return this.tags([...this.active.field.value, tag]);
  }
  commit(focus = false) {
    if (!this.active) return true;
    const { field, panel } = this.active;
    if (field.type === 'color') { this.close(focus); return true; }
    if (field.type === 'tags') {
      const tag = panel.querySelector('[data-tag-input]').value.trim();
      if (tag && !field.value.includes(tag) && !this.apply({ tags: [...field.value, tag] })) return false;
      this.close(); this.render();
      if (focus) this.element.querySelector('[data-edit-property="$tags"]')?.focus();
      return true;
    }
    try {
      const control = panel.querySelector('input:not([type=search]),select');
      if (control && !control.checkValidity()) throw new Error(`Enter a valid value for ${field.name}.`);
      const many = field.type === 'multi-select' || field.type === 'relation' && field.cardinality === 'many';
      const raw = field.type === 'relation' || many ? [...panel.querySelectorAll('input[name="property-choice"]:checked')].map(input => input.value) : panel.querySelector('input,select').value;
      const value = propertyValue(field, many ? raw : Array.isArray(raw) ? raw[0] || '' : raw);
      const patch = field.id === '$title' ? { title: value } : { properties: { [field.id]: value } };
      const unchanged = JSON.stringify(value) === JSON.stringify(field.value) || empty(value) && empty(field.value);
      if (!unchanged && !this.apply(patch)) return false;
      const id = field.id; this.close(); this.render();
      if (focus) [...this.element.querySelectorAll('[data-edit-property]')].find(button => button.dataset.editProperty === id)?.focus();
      return true;
    } catch (error) { this.error(error.message); return false; }
  }
  destroy() { this.destroyed = true; }
}
