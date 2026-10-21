import { EditorState, TextSelection, Selection } from 'prosemirror-state';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';
import { baseKeymap, toggleMark, chainCommands, exitCode } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo, closeHistory } from 'prosemirror-history';
import { inputRules, InputRule, textblockTypeInputRule, wrappingInputRule, undoInputRule } from 'prosemirror-inputrules';
import { splitListItem, liftListItem } from 'prosemirror-schema-list';
import { tableEditing, goToNextCell } from 'prosemirror-tables';
import { Slice } from 'prosemirror-model';
import { editorSchema as schema, MarkdownBridge, taskPositions } from './rich-markdown.js';
import model from './workspace.js';
import PageLinkPicker from './page-link-picker.js';
import SlashPicker from './slash-picker.js';
import MicroPropertyPicker from './micro-property-picker.js';
import { propertyQuery, entryFields, fieldValue, microLabel } from './micro-syntax.js';
import { indentCode, indentList } from './editor-indent.js';

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
    this.element = element; this.options = options; this.bridge = new MarkdownBridge(options.body()); this.microTokens = [];
    this.mount = document.createElement('div'); element.append(this.mount);
    this.view = new EditorView(this.mount, {
      state: EditorState.create({ schema, doc: this.bridge.doc, plugins: [history(), rules(), keymap({ 'Mod-End': documentEdge(true), 'Mod-Home': documentEdge(false), 'Mod-ArrowDown': documentEdge(true), 'Mod-ArrowUp': documentEdge(false), 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo, 'Mod-b': toggleMark(schema.marks.strong), 'Mod-i': toggleMark(schema.marks.em), 'Mod-`': toggleMark(schema.marks.code), Enter: enterList, Tab: chainCommands(indentCode(), goToNextCell(1), indentList()), 'Shift-Tab': chainCommands(indentCode(true), goToNextCell(-1), indentList(true)), Backspace: undoInputRule, 'Mod-Enter': exitCode }), keymap(baseKeymap), tableEditing()] }),
      editable: () => !options.readOnly,
      attributes: { 'aria-readonly': String(!!options.readOnly), class: 'b-rich-document', role: 'textbox', 'aria-label': options.label, 'aria-multiline': 'true', spellcheck: 'true' },
      dispatchTransaction: tr => this.dispatch(tr),
      decorations: state => DecorationSet.create(state.doc, [...taskPositions(state.doc).filter(({ node }) => node.attrs.todoId && options.validTask?.(node.attrs.todoId, node.attrs.href)).map(({ node, position }) => Decoration.node(position + 1, position + 1 + node.firstChild.nodeSize, { role: 'link', tabindex: '0', 'data-todo-link': node.attrs.todoId, 'aria-label': node.firstChild.textContent, title: 'Open todo · Alt-click to edit text' })), ...this.microTokens.map(token => Decoration.widget(token.position, () => this.microTokenElement(token), { side: -1, key: token.key, stopEvent: () => true }))]),
      handleKeyDown: (_view, event) => {
        if (this.microPicker?.keydown(event) || this.slashPicker?.keydown(event) || this.pagePicker?.keydown(event)) return true;
        if (event.key === 'Backspace' && !event.isComposing && !this.view.composing && this.view.state.selection.empty) {
          const token = this.microTokens.findLast(token => token.position === this.view.state.selection.from);
          if (token) { event.preventDefault(); this.editMicroToken(token); return true; }
        }
        if (event.key === 'Enter' && !event.isComposing && !this.view.composing) this.finishMicro();
        const link = event.target.closest('[data-todo-link]');
        if (link && event.target === link && event.key === 'Enter') { event.preventDefault(); options.openRecord?.(link.dataset.todoLink); return true; }
        return false;
      },
      nodeViews: { list_item: (node, view, getPos) => new ListItemView(node, view, getPos, this) },
      clipboardTextParser: text => Slice.maxOpen(new MarkdownBridge(text).doc.content),
      transformPastedHTML: safePaste,
      handleDOMEvents: { compositionend: () => { setTimeout(() => { if (!this.destroyed) { this.publish(); this.pagePicker?.update(); this.slashPicker?.update(); this.microPicker?.update(); } }, 0); return false; } },
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
    if (options.microContext && !options.readOnly) this.microPicker = new MicroPropertyPicker(element, {
      host: this.view.dom, workspace: options.workspace, today: options.today,
      query: () => this.microQuery(), rect: context => this.view.coordsAtPos(context.to),
      fields: context => entryFields(options.workspace(), context.database),
      value: (context, field) => fieldValue(options.workspace().records[context.target], field),
      apply: (context, field, patch) => this.applyMicro(context, field, patch), focus: () => this.view.focus()
    });
    this.microBlur = () => setTimeout(() => {
      if (!this.destroyed && !this.view.dom.contains(document.activeElement) && !this.microPicker?.menu.contains(document.activeElement)) this.finishMicro();
    }, 0);
    this.microWindowBlur = () => { if (!this.microPicker?.active) this.finishMicro(); };
    this.view.dom.addEventListener('blur', this.microBlur, true); window.addEventListener('blur', this.microWindowBlur);
  }
  dispatch(tr) {
    if (this.options.readOnly && tr.docChanged) return;
    const previous = this.view.state;
    if (tr.docChanged && !previous.selection.empty) tr = closeHistory(tr);
    const next = previous.apply(tr); this.mapMicroTokens(tr, next); this.view.updateState(next);
    if (tr.docChanged && !this.view.composing) this.publish(previous);
    this.pagePicker?.update(); this.slashPicker?.update(); this.microPicker?.update();
  }
  microQuery() {
    const { selection } = this.view.state, { $from } = selection;
    if (!selection.empty || this.view.composing || !$from.parent.isTextblock || $from.parent.type.spec.code || $from.marks().some(mark => mark.type.name === 'code')) return null;
    const text = $from.parent.textBetween(0, $from.parentOffset, '\n', '\ufffc'), query = propertyQuery(text);
    if (!query || /\[\[[^\]\n]*$/.test(text) || text.trimStart().startsWith('/')) return null;
    let todo;
    for (let depth = $from.depth; depth > 0; depth--) if ($from.node(depth).type.name === 'list_item' && $from.node(depth).attrs.checked !== null && $from.index(depth) === 0) {
      todo = $from.node(depth).attrs.todoId;
      if (!todo || !this.options.validTask?.(todo, $from.node(depth).attrs.href)) return null;
      break;
    }
    const context = this.options.microContext(todo);
    return context && { ...context, todo: !!todo, paragraph: $from.start() - 1, from: $from.pos - text.length + query.from, to: $from.pos, text: query.text, token: text.slice(query.from) };
  }
  applyMicro(context, field, patch) {
    if (this.view.state.doc.textBetween(context.from, context.to) !== context.token) throw new Error('The text changed. Select the property again.');
    let from = context.from;
    const paragraph = this.view.state.doc.nodeAt(context.paragraph);
    if (context.todo && context.to === context.paragraph + 1 + paragraph.content.size) {
      while (from > context.paragraph + 1 && /\s/.test(this.view.state.doc.textBetween(from - 1, from))) from--;
    }
    const transaction = closeHistory(this.view.state.tr.delete(from, context.to));
    transaction.setSelection(TextSelection.create(transaction.doc, from));
    if (context.todo && !transaction.doc.nodeAt(context.paragraph)?.textContent.trim()) throw new Error('Add a todo title before setting properties.');
    const body = this.bridge.serialize(transaction.doc);
    this.options.applyMicro(body, context.target, patch);
    const next = this.view.state.apply(transaction); this.mapMicroTokens(transaction, next);
    this.microTokens = this.microTokens.filter(token => token.target !== context.target || token.field.id !== field.id);
    this.microTokens.push({ position: from, field, target: context.target, todo: context.todo, key: crypto.randomUUID(), label: microLabel(this.options.workspace(), field, fieldValue(this.options.workspace().records[context.target], field)) });
    this.view.updateState(next);
    this.syncTasks(); this.bridge.remember(this.view.state.doc, this.options.body());
  }
  microTokenElement(token) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'b-micro-token'; button.contentEditable = 'false';
    button.dataset.inlineMicro = token.field.id; button.textContent = token.label; button.setAttribute('aria-label', `Edit ${token.label}`);
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); this.editMicroToken(this.microTokens.find(current => current.key === token.key)); });
    return button;
  }
  mapMicroTokens(transaction, state) {
    this.microTokens = this.microTokens.map(token => ({ ...token, position: transaction.mapping.map(token.position, -1) })).filter(token => token.position >= 0 && token.position <= state.doc.content.size && state.doc.resolve(token.position).parent === state.selection.$from.parent);
  }
  editMicroToken(token) {
    if (this.destroyed || !this.microPicker || !token) return;
    const $position = this.view.state.doc.resolve(token.position);
    const record = this.options.workspace().records[token.target];
    if (!record) return;
    this.microPicker.edit({ from: token.position, to: token.position, token: '', target: token.target, database: record.database || null, todo: token.todo, paragraph: $position.start() - 1 }, token.field);
  }
  finishMicro() {
    if (!this.microTokens.length) return;
    this.microTokens = []; this.view.updateState(this.view.state);
  }
  publish(previous) {
    try {
      const body = this.bridge.serialize(this.view.state.doc);
      if (body !== this.options.body()) this.options.change(body);
      this.syncTasks(); this.bridge.remember(this.view.state.doc, this.options.body());
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
    if (tr.docChanged) {
      const next = this.view.state.apply(tr.setMeta('addToHistory', false)); this.mapMicroTokens(tr, next); this.view.updateState(next);
    }
  }
  navigationState() { return { selection: this.view.state.selection.toJSON(), focused: this.view.hasFocus() }; }
  restoreNavigationState(value) {
    try { this.view.dispatch(this.view.state.tr.setSelection(Selection.fromJSON(this.view.state.doc, value.selection))); } catch { /* Content may have changed since this visit. */ }
    if (value.focused) this.view.focus();
  }
  focus() { this.view.focus(); }
  destroy() { this.destroyed = true; this.view.dom.removeEventListener('blur', this.microBlur, true); window.removeEventListener('blur', this.microWindowBlur); this.pagePicker?.destroy(); this.slashPicker?.destroy(); this.microPicker?.destroy(); this.view.destroy(); }
}
