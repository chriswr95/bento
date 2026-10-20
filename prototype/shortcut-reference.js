import { shortcuts, bindingsFor, keyLabel, isMac } from './shortcuts.js';
import { escapeProperty as escape } from './property-editor.js';
export default class ShortcutReference {
  constructor(element, { mac = isMac() } = {}) {
    this.element = element; this.mac = mac;
    element.innerHTML = `<h2>Keyboard shortcuts</h2><label class="b-visually-hidden" for="b-shortcut-search">Search keyboard shortcuts</label><input id="b-shortcut-search" type="search" placeholder="Search commands or keys…" autocomplete="off"><div class="b-shortcut-table"><table><thead><tr><th scope="col">Command</th><th scope="col">Keybinding</th><th scope="col">When</th></tr></thead><tbody></tbody></table></div><p data-shortcut-empty class="b-muted" hidden>No matching shortcuts.</p>`;
    this.search = element.querySelector('input'); this.search.addEventListener('input', () => this.render()); this.render();
  }
  render() {
    const terms = this.search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = shortcuts.filter(shortcut => {
      const text = [shortcut.command, shortcut.context, ...bindingsFor(shortcut, this.mac).map(binding => keyLabel(binding, this.mac))].join(' ').toLowerCase();
      return terms.every(term => text.includes(term)) || text.replace(/[+\s]/g, '').includes(this.search.value.toLowerCase().replace(/[+\s]/g, ''));
    });
    this.element.querySelector('tbody').innerHTML = matches.map(shortcut => `<tr data-shortcut-command="${shortcut.id}"><td>${escape(shortcut.command)}</td><td>${bindingsFor(shortcut, this.mac).map(binding => `<kbd>${escape(keyLabel(binding, this.mac))}</kbd>`).join(' <span class="b-muted">or</span> ')}</td><td>${escape(shortcut.context)}</td></tr>`).join('');
    this.element.querySelector('[data-shortcut-empty]').hidden = !!matches.length;
  }
  focus() { this.element.scrollIntoView({ block: 'start' }); this.search.focus({ preventScroll: true }); }
}
