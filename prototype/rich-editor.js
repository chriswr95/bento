import { EditorState, TextSelection, Selection } from 'prosemirror-state';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
import { baseKeymap, toggleMark, chainCommands, exitCode } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo, closeHistory } from 'prosemirror-history';
import { inputRules, InputRule, textblockTypeInputRule, wrappingInputRule, undoInputRule } from 'prosemirror-inputrules';
import { splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { tableEditing, goToNextCell } from 'prosemirror-tables';
import { Slice, Fragment } from 'prosemirror-model';
import { editorSchema as schema, MarkdownBridge, taskPositions } from './rich-markdown.js';
import model from './workspace.js';
import PageLinkPicker from './page-link-picker.js';
import SlashPicker from './slash-picker.js';

function taskRule(state, match, start, end) {
  const $from = state.doc.resolve(start); if ($from.parent.type !== schema.nodes.paragraph) return null;
  const tr = state.tr.delete(start, end);
  for (let depth = $from.depth - 1; depth > 0; depth--) {
    if ($from.node(depth).type === schema.nodes.list_item) {
      if ($from.node(depth).attrs.checked !== null) return null;
      return tr.setNodeMarkup($from.before(depth), null, { checked: /x/i.test(match[1]), href: null, todoId: null });
    }
  }
  const paragraph = schema.nodes.paragraph.create(null, $from.parent.content.cut(end - $from.start()));
  const list = schema.nodes.bullet_list.create({ tight: true }, schema.nodes.list_item.create({ checked: /x/i.test(match[1]) }, paragraph));
  const result = state.tr.replaceWith($from.before(), $from.after(), list);
  return result.setSelection(TextSelection.create(result.doc, $from.before() + 3));
}
function markRule(pattern, mark) {
  return new InputRule(pattern, (state, match, start, end) => {
    return state.tr.replaceWith(start, end, schema.text(match[1], mark.create().addToSet(state.storedMarks || state.selection.$from.marks()))).removeStoredMark(mark);
  });
}
function rules() {
  return inputRules({ rules: [
    new InputRule(/^\s*(?:[-+*]\s+)?\[([ xX]?)\]\s$/, taskRule),
    textblockTypeInputRule(/^(#{1,6})\s$/, schema.nodes.heading, match => ({ level: match[1].length })),
    wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list, { tight: true }),
    wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list, match => ({ order: +match[1], tight: true })),
    wrappingInputRule(/^>\s$/, schema.nodes.blockquote),
    textblockTypeInputRule(/^```([\w-]*)\s$/, schema.nodes.code_block, match => ({ params: match[1] })),
    markRule(/\*\*([^*]+)\*\*$/, schema.marks.strong), markRule(/(?<!\*)\*([^*]+)\*$/, schema.marks.em),
    markRule(/`([^`]+)`$/, schema.marks.code), markRule(/~~([^~]+)~~$/, schema.marks.strike)
  ] });
}
function documentEdge(end) { return (state, dispatch) => { if (dispatch) dispatch(state.tr.setSelection(end ? Selection.atEnd(state.doc) : Selection.atStart(state.doc)).scrollIntoView()); return true; }; }
function enterList(state, dispatch) {
  const $from = state.selection.$from;
  for (let depth = $from.depth - 1; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type !== schema.nodes.list_item) continue;
    const attrs = node.attrs.checked === null ? {} : { checked: false, todoId: null, href: null };
    const splitDispatch = dispatch && (tr => {
      const $next = tr.selection.$from;
      const nextDepth = $next.depth - 1;
      if (nextDepth > 0 && $next.node(nextDepth).type === schema.nodes.list_item) {
        if ($from.parentOffset === 0 && $from.parent.content.size > 0) {
          tr = tr.setNodeMarkup($from.before(depth), null, attrs).setNodeMarkup($next.before(nextDepth), null, node.attrs);
        } else tr = tr.setNodeMarkup($next.before(nextDepth), null, attrs);
      }
      dispatch(tr);
    });
    return chainCommands(splitListItem(schema.nodes.list_item, attrs), liftListItem(schema.nodes.list_item))(state, splitDispatch);
  }
  return false;
}
class ListItemView {
  constructor(node, view, getPos, owner) {
    this.view = view; this.getPos = getPos; this.owner = owner;
    this.dom = document.createElement('li');
    this.checkbox = document.createElement('input'); this.checkbox.type = 'checkbox'; this.checkbox.contentEditable = 'false';
    this.checkbox.addEventListener('change', event => { event.stopPropagation(); const current = view.state.doc.nodeAt(getPos()); view.dispatch(view.state.tr.setNodeMarkup(getPos(), null, { ...current.attrs, checked: this.checkbox.checked })); });
    this.contentDOM = document.createElement('div'); this.contentDOM.className = 'b-rich-item-content';
    this.dom.append(this.checkbox, this.contentDOM); this.update(node);
  }
  update(node) {
    if (node.type !== schema.nodes.list_item) return false;
    this.node = node; const task = node.attrs.checked !== null;
    this.dom.className = task ? 'b-rich-task' : '';
    this.checkbox.hidden = !task; this.checkbox.checked = !!node.attrs.checked;
    const resolved = !!node.attrs.todoId && !!this.owner.options.validTask?.(node.attrs.todoId, node.attrs.href);
    this.checkbox.disabled = !!this.owner.options.readOnly || !!node.attrs.href && !resolved;
    this.checkbox.setAttribute('aria-label', `Complete ${node.firstChild.textContent}`);
    return true;
  }
  stopEvent(event) { return event.target === this.checkbox; }
  ignoreMutation(mutation) { return mutation.type !== 'selection' && (mutation.target === this.dom || mutation.target === this.checkbox); }
}
function safePaste(html) {
  const template = document.createElement('template'); template.innerHTML = html;
  template.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(node => node.remove());
  template.content.querySelectorAll('img').forEach(node => node.replaceWith(document.createTextNode(`[Image: ${node.alt}]`)));
  return template.innerHTML;
}

export default class RichEditor {
  constructor(element, options) {
    this.element = element; this.options = options; this.bridge = new MarkdownBridge(options.body());
    this.mount = document.createElement('div'); element.append(this.mount);
    this.view = new EditorView(this.mount, {
      state: EditorState.create({ schema, doc: this.bridge.doc, plugins: [history(), rules(), keymap({ 'Mod-End': documentEdge(true), 'Mod-Home': documentEdge(false), 'Mod-ArrowDown': documentEdge(true), 'Mod-ArrowUp': documentEdge(false), 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo, 'Mod-b': toggleMark(schema.marks.strong), 'Mod-i': toggleMark(schema.marks.em), 'Mod-`': toggleMark(schema.marks.code), Enter: enterList, Tab: chainCommands(goToNextCell(1), sinkListItem(schema.nodes.list_item)), 'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(schema.nodes.list_item)), Backspace: undoInputRule, 'Mod-Enter': exitCode }), keymap(baseKeymap), tableEditing()] }),
      editable: () => !options.readOnly,
      attributes: { 'aria-readonly': String(!!options.readOnly), class: 'b-rich-document', role: 'textbox', 'aria-label': options.label, 'aria-multiline': 'true', spellcheck: 'true' },
      dispatchTransaction: tr => this.dispatch(tr),
      decorations: state => DecorationSet.create(state.doc, taskPositions(state.doc).filter(({ node }) => node.attrs.todoId && options.validTask?.(node.attrs.todoId, node.attrs.href)).map(({ node, position }) => Decoration.node(position + 1, position + 1 + node.firstChild.nodeSize, { role: 'link', tabindex: '0', 'data-todo-link': node.attrs.todoId, 'aria-label': node.firstChild.textContent, title: 'Open todo · Alt-click to edit text' }))),
      handleKeyDown: (_view, event) => {
        if (this.slashPicker?.keydown(event) || this.pagePicker?.keydown(event)) return true;
        const link = event.target.closest('[data-todo-link]');
        if (link && event.target === link && event.key === 'Enter') { event.preventDefault(); options.openRecord?.(link.dataset.todoLink); return true; }
        return false;
      },
      nodeViews: { list_item: (node, view, getPos) => new ListItemView(node, view, getPos, this) },
      clipboardTextParser: text => Slice.maxOpen(new MarkdownBridge(text).doc.content),
      transformPastedHTML: safePaste,
      handleDOMEvents: { compositionend: () => { setTimeout(() => { if (!this.destroyed) { this.publish(); this.pagePicker?.update(); this.slashPicker?.update(); } }, 0); return false; } },
      handleClick: (_view, _pos, event) => {
        const todo = event.target.closest('[data-todo-link]');
        if (todo && !event.altKey && event.detail < 2 && this.view.state.selection.empty) { event.preventDefault(); options.openRecord?.(todo.dataset.todoLink); return true; }
        const link = event.target.closest('a'); if (!link) return false;
        event.preventDefault();
        if (!event.altKey && this.options.isPageLink?.(link.getAttribute('href'))) { this.options.openLink?.(link.getAttribute('href')); return true; }
        if (event.metaKey || event.ctrlKey) this.options.openLink?.(link.getAttribute('href'));
        return false;
      }
    });
    this.syncTasks(); this.pagePicker = new PageLinkPicker(this, options); this.slashPicker = new SlashPicker(this, options);
  }
  dispatch(tr) {
    if (this.options.readOnly && tr.docChanged) return;
    const previous = this.view.state;
    if (tr.docChanged && !previous.selection.empty) tr = closeHistory(tr);
    this.view.updateState(previous.apply(tr));
    if (tr.docChanged && !this.view.composing) this.publish(previous);
    this.pagePicker?.update(); this.slashPicker?.update();
  }
  publish(previous) {
    try {
      const body = this.bridge.serialize(this.view.state.doc);
      if (body !== this.options.body()) this.options.change(body);
      this.syncTasks(); this.syncChildren(); this.bridge.remember(this.view.state.doc, this.options.body());
    } catch (error) { if (previous) this.view.updateState(previous); this.options.error?.(error.message); }
  }
  syncTasks() {
    const canonical = model.parse(this.options.body()).tasks;
    const positions = taskPositions(this.view.state.doc);
    if (canonical.length !== positions.length) return;
    let tr = this.view.state.tr;
    for (let index = positions.length - 1; index >= 0; index--) {
      const { node, position } = positions[index], task = canonical[index];
      const resolved = !!task.todoId && !!this.options.validTask?.(task.todoId, task.href);
      const attrs = { ...node.attrs, checked: task.done, todoId: task.todoId, href: task.href };
      if (JSON.stringify(attrs) !== JSON.stringify(node.attrs)) tr = tr.setNodeMarkup(position, null, attrs);
      if (task.todoId && resolved && node.firstChild.textContent !== task.title) {
        const canonicalNode = taskPositions(new MarkdownBridge(this.options.body()).doc)[index]?.node;
        if (canonicalNode) tr = tr.replaceWith(position + 2, position + 2 + node.firstChild.content.size, canonicalNode.firstChild.content);
      }
    }
    if (tr.docChanged) this.view.updateState(this.view.state.apply(tr.setMeta('addToHistory', false)));
  }
  syncChildren() {
    const children = this.options.children?.() || [], linked = new Set();
    if (!children.length) return;
    this.view.state.doc.descendants(node => {
      for (const mark of node.marks) if (mark.type === schema.marks.link) linked.add(this.options.pageTarget?.(mark.attrs.href));
    });
    const missing = children.filter(child => !linked.has(child.id)); if (!missing.length) return;
    const paragraphs = missing.map(child => schema.nodes.paragraph.create(null, schema.text(child.title, [schema.marks.link.create({ href: this.options.pageHref(child.id) })])));
    const transaction = this.view.state.tr.insert(this.view.state.doc.content.size, Fragment.fromArray(paragraphs)).setMeta('addToHistory', false);
    this.view.updateState(this.view.state.apply(transaction));
  }
  pageInsertion(range) {
    const state = this.view.state, bridge = this.bridge;
    return (title, href) => {
      const transaction = state.tr.insertText(title, range.from, range.to);
      transaction.addMark(range.from, range.from + title.length, schema.marks.link.create({ href }));
      return bridge.serialize(transaction.doc);
    };
  }
  navigationState() { return { selection: this.view.state.selection.toJSON(), focused: this.view.hasFocus() }; }
  restoreNavigationState(value) {
    try { this.view.dispatch(this.view.state.tr.setSelection(Selection.fromJSON(this.view.state.doc, value.selection))); } catch { /* Content may have changed since this visit. */ }
    if (value.focused) this.view.focus();
  }
  focus() { this.view.focus(); }
  destroy() { this.destroyed = true; this.pagePicker?.destroy(); this.slashPicker?.destroy(); this.view.destroy(); }
}
