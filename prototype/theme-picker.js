import { builtinThemes, selectedTheme, installTheme, removeTheme } from './themes.js';
import { escapeProperty as escape } from './property-editor.js';
export default class ThemePicker {
  constructor(element, options) {
    this.element = element; this.options = options;
    this.render();
    element.addEventListener('change', event => {
      if (event.target.matches('[data-color-theme]')) this.run(() => options.change({ ...options.preferences(), colorTheme: event.target.value }));
      if (event.target.matches('[data-appearance-mode]')) this.run(() => options.mode(event.target.value));
      if (event.target.matches('[data-theme-file]')) this.import(event.target.files[0]);
    });
    element.addEventListener('click', event => {
      if (event.target.closest('[data-install-theme]')) element.querySelector('[data-theme-file]').click();
      if (event.target.closest('[data-remove-theme]')) this.run(() => options.change(removeTheme(options.preferences(), options.preferences().colorTheme)));
      if (event.target.closest('[data-export-theme]')) this.export();
    });
  }
  render() {
    const preferences = this.options.preferences(), current = selectedTheme(preferences);
    const missing = preferences.colorTheme !== current.id;
    this.element.innerHTML = `<h2>Appearance</h2><div class="b-form"><label class="b-field">Color theme<select data-color-theme><optgroup label="Built in">${builtinThemes.map(theme => this.option(theme, current)).join('')}</optgroup>${preferences.themes.length ? `<optgroup label="Installed">${preferences.themes.map(theme => this.option(theme, current)).join('')}</optgroup>` : ''}</select></label><label class="b-field">Mode<select data-appearance-mode>${['system','light','dark'].map(mode => `<option value="${mode}" ${this.options.appearance() === mode ? 'selected' : ''}>${mode === 'system' ? 'Follow system' : mode[0].toUpperCase() + mode.slice(1)}</option>`).join('')}</select></label></div>
      <p class="b-muted b-theme-description">${escape(current.description || 'Custom Bento theme.')}</p>
      <div class="b-theme-swatches" aria-hidden="true">${['paper','side','ink','accent'].map(token => `<span style="background:${current[this.options.dark() ? 'dark' : 'light'][token]}"></span>`).join('')}</div>
      <div class="b-actions"><button type="button" class="b-button" data-install-theme>Install theme…</button><button type="button" class="b-button" data-export-theme>Export template</button>${!builtinThemes.some(theme => theme.id === current.id) ? '<button type="button" class="b-button" data-remove-theme>Remove theme</button>' : ''}</div>
      <input type="file" accept=".json,application/json" data-theme-file aria-label="Theme file" hidden>
      <p class="b-muted">Install a Bento theme JSON file. Themes include light and dark palettes.</p>
      <p class="b-issues" data-theme-error role="alert" ${missing || preferences.warning ? '' : 'hidden'}>${escape(missing ? 'Selected theme is unavailable. Using Bento.' : preferences.warning || '')}</p>`;
  }
  option(theme, current) { return `<option value="${escape(theme.id)}" ${current.id === theme.id ? 'selected' : ''}>${escape(theme.name)}</option>`; }
  async run(operation) {
    if (this.busy) return;
    this.busy = true; this.element.querySelectorAll('button,select').forEach(control => { control.disabled = true; });
    try { await operation(); this.render(); }
    catch (error) {
      this.render(); const message = this.element.querySelector('[data-theme-error]'); message.hidden = false; message.textContent = error.message;
    } finally { this.busy = false; }
  }
  async import(file) {
    if (!file) return;
    await this.run(async () => {
      if (file.size > 32768) throw new Error('Theme files must be smaller than 32 KB.');
      await this.options.change(installTheme(this.options.preferences(), await file.text()));
    });
  }
  export() {
    const selected = selectedTheme(this.options.preferences());
    const template = { ...selected, id: 'custom-' + selected.id.slice(0, 56), name: selected.name.slice(0, 70) + ' Custom' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = template.id + '.bento-theme.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
