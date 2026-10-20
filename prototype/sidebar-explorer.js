/* Sidebar input and menus stay separate from document editing and filesystem writes. */
import { isMac } from './shortcuts.js';
export default class SidebarExplorer {
  constructor(sidebar, host, options) {
    this.sidebar = sidebar; this.options = options; this.selection = null;
    this.menu = document.createElement('div'); this.menu.className = 'b-explorer-menu'; this.menu.hidden = true;
    this.menu.setAttribute('role', 'menu'); host.append(this.menu);
    sidebar.addEventListener('contextmenu', event => {
      if (!event.target.closest('.b-directory-tree') || !options.available()) return;
      event.preventDefault();
      const row = this.rowAt(event.target) || sidebar.querySelector('summary [data-open-folder=""]');
      if (row) this.show(row, event.clientX, event.clientY);
    });
    sidebar.addEventListener('focusin', event => { const row = this.rowAt(event.target); if (row) this.select(row); });
    sidebar.addEventListener('keydown', event => this.keydown(event));
    this.menu.addEventListener('keydown', event => this.menuKeydown(event));
    this.menu.addEventListener('click', event => {
      const button = event.target.closest('[data-explorer-action]');
      if (button && !button.disabled) this.run(Number(button.dataset.explorerAction));
    });
    document.addEventListener('pointerdown', event => { if (!this.menu.contains(event.target)) this.close(false); }, true);
    document.addEventListener('scroll', event => { if (this.open && !this.menu.contains(event.target) && this.anchor !== this.position()) this.close(false); }, true);
    window.addEventListener('resize', () => { if (this.open && this.anchor !== this.position()) this.close(false); });
    window.addEventListener('blur', () => this.close(false));
  }
  get open() { return !this.menu.hidden; }
  rowAt(target) {
    const row = target.closest('[data-record], [data-open-folder]') || target.closest('summary')?.querySelector('[data-open-folder]');
    return row && this.sidebar.contains(row) && row.closest('.b-directory-tree') ? row : null;
  }
  target(row) { return row.hasAttribute('data-record') ? { kind: 'file', id: row.dataset.record } : { kind: 'folder', path: row.dataset.openFolder }; }
  matches(row, target) { return target?.kind === 'file' ? row.dataset.record === target.id : target?.kind === 'folder' && row.dataset.openFolder === target.path; }
  rows() { return [...this.sidebar.querySelectorAll('.b-directory-tree [data-record], .b-directory-tree summary [data-open-folder]')].filter(row => row.getClientRects().length && !row.disabled); }
  selectedRow() { return this.rows().find(row => this.matches(row, this.selection)); }
  select(row) { this.selection = this.target(row); this.refresh(); }
  refresh() {
    for (const row of this.sidebar.querySelectorAll('[data-record], [data-open-folder]')) row.toggleAttribute('data-sidebar-selected', this.matches(row, this.selection));
  }
  focusFile(id) {
    const row = this.rows().find(row => row.dataset.record === id);
    if (row) { row.focus({ preventScroll: true }); row.scrollIntoView({ block: 'nearest' }); }
  }
  position() {
    const row = this.rows().find(row => this.matches(row, this.origin)), bounds = row?.getBoundingClientRect();
    const tree = this.sidebar.querySelector('.b-directory-tree');
    return [bounds?.left, bounds?.top, bounds?.width, bounds?.height, scrollX, scrollY, tree?.scrollTop, tree?.scrollLeft, innerWidth, innerHeight].map(value => Math.round(value ?? -1)).join(':');
  }
  show(row, x, y) {
    this.close(false); this.select(row); row.focus({ preventScroll: true });
    const target = this.target(row);
    this.origin = target;
    this.actions = target.kind === 'folder' ? [
      { title: 'Open folder', run: () => this.options.openFolder(target.path) },
      { title: 'New file…', disabled: !this.options.canCreate(target.path), run: () => this.options.createFile(target.path) },
      { title: 'New folder…', disabled: !this.options.canCreate(target.path), run: () => this.options.createFolder(target.path) }
    ] : [
      { title: 'Open', run: () => this.options.openFile(target.id) },
      { title: 'Move to…', disabled: !this.options.canDelete(target.id), run: () => this.options.moveFile(target.id) },
      { title: 'Delete', disabled: !this.options.canDelete(target.id), hint: 'Delete', run: () => this.remove(row) }
    ];
    this.menu.setAttribute('aria-label', target.kind === 'folder' ? 'Folder actions' : 'File actions');
    this.menu.replaceChildren(...this.actions.map((action, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.setAttribute('role', 'menuitem');
      button.dataset.explorerAction = index; button.disabled = !!action.disabled; button.textContent = action.title;
      if (action.hint) { const hint = document.createElement('span'); hint.textContent = action.hint; hint.setAttribute('aria-hidden', 'true'); button.append(hint); }
      return button;
    }));
    this.menu.hidden = false;
    const bounds = this.menu.getBoundingClientRect();
    this.menu.style.left = Math.max(8, Math.min(x, innerWidth - bounds.width - 8)) + 'px';
    this.menu.style.top = Math.max(8, Math.min(y, innerHeight - bounds.height - 8)) + 'px';
    this.anchor = this.position();
    this.menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  close(restoreFocus = true) {
    if (!this.open) return;
    this.menu.hidden = true;
    if (restoreFocus) this.rows().find(row => this.matches(row, this.origin))?.focus({ preventScroll: true });
  }
  async run(index) {
    const action = this.actions[index]; if (!action || action.disabled) return;
    this.close(true);
    try { await action.run(); } catch (error) { this.options.error(error.message); }
  }
  async remove(row) {
    const id = row.dataset.record;
    if (!id || !this.options.canDelete(id) || !this.options.available()) return;
    const index = this.rows().findIndex(item => item.dataset.record === id);
    const removed = await this.options.removeFile(id);
    if (removed) {
      const rows = this.rows(), next = rows[Math.max(0, Math.min(index, rows.length - 1))];
      next?.focus({ preventScroll: true }); next?.scrollIntoView({ block: 'nearest' });
    }
  }
  keydown(event) {
    const row = this.rowAt(event.target);
    if (!row || !this.rows().includes(row) || !this.options.available() || event.isComposing) return;
    if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); const bounds = row.getBoundingClientRect(); this.show(row, bounds.left, bounds.bottom); return;
    }
    const primary = isMac() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
    if (event.key.toLowerCase() === 'z' && primary && !event.altKey && !event.shiftKey && this.options.canRestore()) {
      event.preventDefault(); if (!event.repeat) this.options.restoreFile().catch(error => this.options.error(error.message)); return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (['Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault(); if (!event.repeat) this.remove(row).catch(error => this.options.error(error.message)); return;
    }
    const rows = this.rows(), index = rows.indexOf(row);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      rows[next]?.focus(); return;
    }
    const details = row.closest('summary')?.parentElement;
    if (event.key === 'ArrowRight' && details) {
      event.preventDefault(); if (!details.open) details.open = true; else rows[index + 1]?.focus();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (details?.open) details.open = false;
      else (details ? details.parentElement.closest('details') : row.closest('details'))?.querySelector(':scope>summary [data-open-folder]')?.focus();
    }
  }
  menuKeydown(event) {
    const buttons = [...this.menu.querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(document.activeElement);
    if (['Escape', 'Tab'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); this.close(); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus({ preventScroll: true });
    }
  }
}
