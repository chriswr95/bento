// The [[ interaction writes a standard Markdown link, never a second identity.
export default class PageLinkPicker {
  constructor(editor, options) {
    this.editor = editor; this.options = options; this.index = 0;
    this.menu = document.createElement('div'); this.menu.className = 'b-page-link-picker';
    this.menu.id = 'b-page-link-picker'; this.menu.setAttribute('role', 'listbox'); this.menu.setAttribute('aria-label', 'Link a page'); this.menu.hidden = true;
    editor.element.append(this.menu);
    this.menu.addEventListener('mousedown', event => event.preventDefault());
    this.menu.addEventListener('click', event => { const option = event.target.closest('[data-page-option]'); if (option) this.choose(Number(option.dataset.pageOption)); });
    this.blur = () => { if (!this.menu.contains(document.activeElement)) this.close(); };
    editor.view.dom.addEventListener('blur', this.blur);
    this.reposition = event => { if (!(event.target instanceof Node) || !this.menu.contains(event.target)) this.close(); };
    window.addEventListener('resize', this.reposition); window.addEventListener('scroll', this.reposition, true);
  }
  query(pattern = /\[\[([^\]\n[]{0,100})$/) {
    const { selection } = this.editor.view.state, { $from } = selection;
    if (!selection.empty || !$from.parent.isTextblock || $from.parent.type.spec.code || $from.marks().some(mark => mark.type.name === 'code')) return null;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === 'list_item' && node.attrs.checked !== null && $from.index(depth) === 0) return null;
    }
    const match = pattern.exec($from.parent.textBetween(0, $from.parentOffset, '\n', '\ufffc'));
    return match ? { from: $from.pos - match[0].length, to: $from.pos, text: match[1] } : null;
  }
  update() {
    if (this.options.readOnly || !this.options.pages || this.editor.view.composing) { this.close(); return; }
    const query = this.query(), key = query && `${query.from}:${query.to}:${query.text}`;
    if (!query || key === this.dismissed) { this.close(); return; }
    this.range = query;
    if (this.menu.hidden) this.entries = this.options.pages();
    const text = query.text.toLocaleLowerCase();
    const rank = page => page.title.toLocaleLowerCase() === text ? 0 : page.title.toLocaleLowerCase().startsWith(text) ? 1 : page.title.toLocaleLowerCase().includes(text) ? 2 : 3;
    this.results = this.entries.filter(page => `${page.title} ${page.detail}`.toLocaleLowerCase().includes(text)).sort((a, b) => text ? rank(a) - rank(b) || a.title.localeCompare(b.title) || a.detail.localeCompare(b.detail) : 0).slice(0, 12);
    this.index = 0; this.menu.replaceChildren();
    for (const [index, page] of this.results.entries()) {
      const option = document.createElement('div'); option.id = `${this.menu.id}-option-${index}`; option.dataset.pageOption = index; option.setAttribute('role', 'option');
      const title = document.createElement('span'), detail = document.createElement('small'); title.textContent = page.title; detail.textContent = page.detail;
      option.append(title, detail); this.menu.append(option);
    }
    if (!this.results.length) this.menu.textContent = this.options.emptyMessage || 'No matching pages';
    this.menu.hidden = false; this.select(0, false);
    const position = this.editor.view.coordsAtPos(query.to), box = this.menu.getBoundingClientRect();
    this.menu.style.left = `${Math.max(8, Math.min(position.left, innerWidth - box.width - 8))}px`;
    this.menu.style.top = `${Math.max(8, position.bottom + box.height < innerHeight - 8 ? position.bottom + 4 : position.top - box.height - 4)}px`;
    this.editor.view.dom.setAttribute('aria-controls', this.menu.id);
  }
  select(index, scroll = true) {
    if (!this.results.length) { this.editor.view.dom.removeAttribute('aria-activedescendant'); return; }
    this.index = (index + this.results.length) % this.results.length;
    this.menu.querySelectorAll('[role=option]').forEach((option, at) => option.setAttribute('aria-selected', String(at === this.index)));
    this.editor.view.dom.setAttribute('aria-activedescendant', `${this.menu.id}-option-${this.index}`);
    if (scroll) this.menu.children[this.index]?.scrollIntoView({ block: 'nearest' });
  }
  keydown(event) {
    if (this.menu.hidden || event.isComposing || this.editor.view.composing) return false;
    if (event.key === 'Escape') { this.dismissed = `${this.range.from}:${this.range.to}:${this.range.text}`; this.close(); }
    else if (['ArrowDown', 'ArrowUp'].includes(event.key)) this.select(this.index + (event.key === 'ArrowDown' ? 1 : -1));
    else if (event.key === 'Enter' && this.results.length) this.choose(this.index);
    else return false;
    event.preventDefault(); event.stopPropagation(); return true;
  }
  choose(index) {
    const page = this.results[index]; if (!page) return;
    const { from, to } = this.range, { view } = this.editor;
    const href = this.options.pageHref(page.id);
    if (!href) { this.close(); return; }
    const transaction = view.state.tr.insertText(page.title, from, to);
    transaction.addMark(from, from + page.title.length, view.state.schema.marks.link.create({ href }));
    transaction.removeStoredMark(view.state.schema.marks.link);
    this.close(); view.dispatch(transaction); view.focus();
  }
  close() {
    this.menu.hidden = true;
    if (this.editor.view.dom.getAttribute('aria-controls') === this.menu.id) {
      this.editor.view.dom.removeAttribute('aria-controls'); this.editor.view.dom.removeAttribute('aria-activedescendant');
    }
  }
  destroy() {
    this.close(); this.menu.remove(); this.editor.view.dom.removeEventListener('blur', this.blur);
    window.removeEventListener('resize', this.reposition); window.removeEventListener('scroll', this.reposition, true);
  }
}
