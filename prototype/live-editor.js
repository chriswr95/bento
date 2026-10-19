import { sourceCaret } from './editor-position.js';
import BentoWorkspace from './workspace.js';
/* Markdown stays authoritative. Only the active block exposes source syntax. */
class LiveEditor {
  constructor(element, options) {
    this.element = element;
    this.options = options;
    this.active = null;
    element.addEventListener('click', event => this.click(event));
    element.addEventListener('keydown', event => this.keydown(event));
    element.addEventListener('input', event => this.input(event));
    element.addEventListener('compositionend', event => this.input(event));
    element.addEventListener('focusout', event => {
      if (event.target.matches('textarea[data-block-source]')) {
        // Let a click on another block finish before replacing its DOM.
        setTimeout(() => {
          if (event.target.isConnected && document.activeElement !== event.target) {
            const focused = document.activeElement;
            const focus = focused?.matches('[data-task-title]') ? { line: Number(focused.dataset.taskTitle), start: focused.selectionStart, end: focused.selectionEnd } : null;
            this.active = null; this.render(focus);
          }
        }, 0);
      } else if (event.target.matches('[data-task-title]') && !event.target.value.trim()) this.render();
    });
    this.render();
  }
  body() { return this.options.body(); }
  blocks() {
    const body = this.body(), tokens = marked.lexer(body);
    if (tokens.map(token => token.raw).join('') !== body) return [{ start: 0, end: body.length, raw: body }];
    let offset = 0;
    return tokens.map(token => {
      const block = { start: offset, end: offset + token.raw.length, raw: token.raw };
      offset = block.end;
      return block;
    }).filter(block => block.raw.trim());
  }
  render(focus = null) {
    const body = this.body();
    this.element.replaceChildren();
    for (const block of this.blocks()) {
      const section = document.createElement('section');
      section.className = 'b-live-block';
      section.dataset.start = block.start;
      section.dataset.end = block.end;
      section.tabIndex = 0;
      section.setAttribute('aria-label', 'Edit Markdown block');
      section.setAttribute('aria-keyshortcuts', 'Enter');
      section.title = 'Click or press Enter to edit Markdown';
      const offset = body.slice(0, block.start).split('\n').length - 1;
      section.innerHTML = this.options.render(block.raw, offset);
      this.element.append(section);
    }
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'b-add-block cursor-interaction';
    add.dataset.append = ''; add.textContent = 'Write a note…';
    this.element.append(add);
    if (focus) {
      const input = this.element.querySelector(`[data-task-title="${focus.line}"]`);
      if (input) { input.focus(); input.setSelectionRange(focus.start, focus.end ?? focus.start); }
    }
  }
  start(block, atEnd = true, caret = null) {
    if (this.active) {
      const start = block.dataset.start;
      this.active = null; this.render();
      block = this.element.querySelector(`[data-start="${start}"]`);
      if (!block) return;
    }
    this.active = { start: Number(block.dataset.start), end: Number(block.dataset.end) };
    const preview = block.firstElementChild;
    const typography = preview ? getComputedStyle(preview) : null;
    const textarea = document.createElement('textarea');
    textarea.dataset.blockSource = '';
    textarea.className = 'b-block-source';
    textarea.setAttribute('aria-label', this.options.label);
    textarea.spellcheck = true;
    if (typography) {
      textarea.style.font = typography.font;
      textarea.style.letterSpacing = typography.letterSpacing;
      textarea.style.margin = typography.margin;
    }
    textarea.value = this.body().slice(this.active.start, this.active.end);
    block.replaceChildren(textarea);
    textarea.focus();
    const position = caret ?? (atEnd ? textarea.value.length : 0);
    textarea.setSelectionRange(position, position);
    this.resize(textarea);
  }
  append() {
    const body = this.body(), gap = body.endsWith('\n\n') ? '' : body.endsWith('\n') ? '\n' : '\n\n';
    this.options.change(body + gap);
    this.render();
    const section = document.createElement('section');
    section.className = 'b-live-block';
    section.dataset.start = section.dataset.end = this.body().length;
    this.element.insertBefore(section, this.element.lastChild);
    this.start(section);
  }
  click(event) {
    if (event.target.closest('[data-append]')) return this.append();
    if (event.target.closest('input,textarea,button,a')) return;
    const block = event.target.closest('[data-start]');
    if (block) {
      // A drag selection should remain a reading selection, not become an edit.
      if (!window.getSelection().isCollapsed) return;
      const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
      const range = point ? null : document.caretRangeFromPoint?.(event.clientX, event.clientY);
      const node = point?.offsetNode || range?.startContainer;
      const offset = point?.offset ?? range?.startOffset;
      const source = this.body().slice(Number(block.dataset.start), Number(block.dataset.end));
      const caret = node?.nodeType === Node.TEXT_NODE && block.contains(node) ? sourceCaret(source, node.textContent, offset) : source.length;
      this.start(block, true, caret);
    }
  }
  resize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(36, textarea.scrollHeight + 2) + 'px';
  }
  replaceLine(line, value) {
    const lines = this.body().split('\n'); lines[line] = value;
    this.options.change(lines.join('\n'));
  }
  input(event) {
    if (event.isComposing) return;
    const input = event.target;
    if (input.matches('[data-task-title]')) {
      if (!input.value.trim()) return; // Keep the last valid title while a replacement is being typed.
      const line = Number(input.dataset.taskTitle), caret = input.selectionStart, end = input.selectionEnd;
      const task = BentoWorkspace.parse(this.body()).tasks.find(task => task.line === line);
      if (!task) return;
      const title = input.value.replace(/[\r\n]/g, ' ');
      this.replaceLine(line, task.todoId ? `${task.prefix}[${BentoWorkspace.escapeLabel(title)}](${this.options.linkFor(task.todoId)})` : task.prefix + title);
      this.render({ line, start: caret, end });
      return;
    }
    if (!input.matches('[data-block-source]') || !this.active) return;
    let value = input.value;
    // Common Markdown shortcuts become an interactive checkbox immediately.
    value = value.replace(/(^|\n)([\t ]*)(?:[-+*] )?\[([ xX]?)\] $/, (_, lead, indent, checked) => `${lead}${indent}- [${checked.toLowerCase() === 'x' ? 'x' : ' '}] `);
    const before = this.body().slice(0, this.active.start), after = this.body().slice(this.active.end);
    const oldStart = this.active.start, caret = input.selectionStart;
    this.options.change(before + value + after);
    const canonical = this.body();
    this.active.end = canonical.length - after.length;
    const tasks = BentoWorkspace.parse(canonical).tasks.filter(task => {
      const start = canonical.split('\n').slice(0, task.line).join('\n').length + (task.line ? 1 : 0);
      return start >= oldStart && start < this.active.end;
    });
    if (tasks.length && (/\[[ xX]?\] $/.test(value) || tasks.some(task => task.todoId))) {
      const line = (before + value.slice(0, caret)).split('\n').length - 1;
      const task = tasks.find(task => task.line === line) || tasks[tasks.length - 1];
      this.active = null;
      this.render({ line: task.line, start: task.title.length });
    } else {
      input.value = canonical.slice(oldStart, this.active.end);
      input.setSelectionRange(caret, caret);
      this.resize(input);
    }
  }
  adjacent(direction) {
    const blocks = this.blocks();
    const next = direction > 0 ? blocks.find(block => block.start >= this.active.end) : blocks.filter(block => block.end <= this.active.start).at(-1);
    if (!next) return false;
    this.active = null; this.render();
    this.start(this.element.querySelector(`[data-start="${next.start}"]`), direction < 0);
    return true;
  }
  keydown(event) {
    if (event.isComposing) return;
    const input = event.target;
    if (input.matches('[data-block-source]') && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && input.selectionStart === input.selectionEnd) {
      const direction = ['ArrowUp', 'ArrowLeft'].includes(event.key) && input.selectionStart === 0 ? -1
        : ['ArrowDown', 'ArrowRight'].includes(event.key) && input.selectionEnd === input.value.length ? 1 : 0;
      if (direction && this.adjacent(direction)) { event.preventDefault(); return; }
    }
    if (input.matches('[data-task-title]') && event.key === 'Enter') {
      event.preventDefault();
      const line = Number(input.dataset.taskTitle), lines = this.body().split('\n');
      const task = BentoWorkspace.parse(this.body()).tasks.find(task => task.line === line);
      if (!task) return;
      if (!input.value.trim()) {
        lines[line] = ''; this.options.change(lines.join('\n')); this.render();
        this.append(); return;
      }
      const start = input.selectionStart, end = input.selectionEnd;
      const left = input.value.slice(0, start), right = input.value.slice(end);
      // At the beginning of a title, insert above rather than emptying the canonical record.
      if (!left.trim()) {
        lines.splice(line, 0, task.prefix.replace(/\[[ xX]\]/, '[ ]'));
        this.options.change(lines.join('\n')); this.render({ line, start: 0 }); return;
      }
      lines[line] = task.todoId ? `${task.prefix}[${BentoWorkspace.escapeLabel(left)}](${this.options.linkFor(task.todoId)})` : task.prefix + left;
      lines.splice(line + 1, 0, task.prefix.replace(/\[[ xX]\]/, '[ ]') + right);
      this.options.change(lines.join('\n'));
      this.render({ line: line + 1, start: 0 });
    } else if (input.matches('[data-block-source]') && event.key === 'Escape') {
      const start = this.active?.start;
      event.preventDefault(); this.active = null; this.render();
      (this.element.querySelector(`[data-start="${start}"]`) || this.element.querySelector('[data-append]')).focus();
    } else if (input.matches('[data-start]') && event.key === 'Enter') {
      event.preventDefault(); this.start(input);
    }
  }
}
export default LiveEditor;
