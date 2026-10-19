import './vendor/marked.umd.js';
import { decodeHTML } from 'entities';
import { Schema, Fragment } from 'prosemirror-model';
import { schema as common, MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';
import model from './workspace.js';

let nodes = common.spec.nodes;
for (const name of ['paragraph', 'heading', 'blockquote', 'code_block', 'bullet_list', 'ordered_list', 'horizontal_rule']) {
  const original = nodes.get(name);
  nodes = nodes.update(name, { ...original, attrs: { ...original.attrs, sourceKey: { default: null } } });
}
nodes = nodes.update('list_item', { ...nodes.get('list_item'), attrs: { checked: { default: null }, todoId: { default: null }, href: { default: null } }, content: 'paragraph block*',
  toDOM: node => ['li', node.attrs.checked === null ? {} : { 'data-bento-checked': String(node.attrs.checked), 'data-bento-href': node.attrs.href || '' }, 0],
  parseDOM: [{ tag: 'li', getAttrs: dom => {
    const input = dom.querySelector('input[type=checkbox]'), href = dom.getAttribute('data-bento-href') || null;
    return { checked: dom.hasAttribute('data-bento-checked') ? dom.getAttribute('data-bento-checked') === 'true' : input ? input.checked : null, href, todoId: href ? model.targetId(href) : null };
  } }]
});
nodes = nodes.update('image', { ...nodes.get('image'), toDOM: node => ['span', { class: 'b-image-placeholder', 'data-image': node.attrs.src }, `[Image: ${node.attrs.alt || ''}]`] });
nodes = nodes.addToEnd('raw', { group: 'block', atom: true, attrs: { raw: {}, sourceKey: { default: null } }, toDOM: node => ['pre', { class: 'b-preserved-markdown', contenteditable: 'false' }, ['code', node.attrs.raw]] });
for (const [name, spec] of Object.entries(tableNodes({ tableGroup: 'block', cellContent: 'paragraph+', cellAttributes: { align: { default: null, getFromDOM: dom => ['left', 'right', 'center'].includes(dom.style.textAlign) ? dom.style.textAlign : null, setDOMAttr: (value, attrs) => { if (value) attrs.style = 'text-align:' + value; } } } }))) nodes = nodes.addToEnd(name, { ...spec, attrs: { ...spec.attrs, ...(name === 'table' ? { sourceKey: { default: null } } : {}) } });
const link = common.spec.marks.get('link');
export const editorSchema = new Schema({ nodes, marks: common.spec.marks.update('link', { ...link, toDOM: mark => ['a', { href: /^(?:https?:|mailto:|[^:]+$)/i.test(mark.attrs.href) ? mark.attrs.href : '#', title: mark.attrs.title }, 0] }).addToEnd('strike', { parseDOM: [{ tag: 's' }, { tag: 'del' }], toDOM: () => ['s', 0] }) });
const s = editorSchema;
const text = (value, marks = []) => value ? s.text(decodeHTML(value), marks) : null;
function inline(tokens, marks = []) {
  return (tokens || []).flatMap(token => {
    if (token.type === 'checkbox') return [];
    const mark = { strong: 'strong', em: 'em', del: 'strike', codespan: 'code', link: 'link' }[token.type];
    if (mark) {
      const next = [...marks, s.marks[mark].create(mark === 'link' ? { href: token.href, title: token.title } : null)];
      return token.tokens ? inline(token.tokens, next) : [mark === 'code' ? s.text(token.text, next) : text(token.text, next)].filter(Boolean);
    }
    if (token.type === 'br') return [s.nodes.hard_break.create()];
    if (token.type === 'image') return [s.nodes.image.create({ src: token.href, alt: token.text, title: token.title }, null, marks)];
    return [text(token.text ?? token.raw, marks)].filter(Boolean);
  });
}
function item(token) {
  const content = blocks(token.tokens.filter(child => child.type !== 'checkbox'));
  if (!content.length || content[0].type !== s.nodes.paragraph) content.unshift(s.nodes.paragraph.create());
  let href = null, todoId = null;
  if (token.task) {
    const children = token.tokens.find(child => child.tokens)?.tokens.filter(child => child.type !== 'checkbox');
    if (children?.length === 1 && children[0].type === 'link') { href = children[0].href; todoId = model.targetId(href); }
    // The outer todo link is navigation metadata; keep the label's formatting.
    content[0] = s.nodes.paragraph.create(null, Fragment.fromArray(Array.from({ length: content[0].childCount }, (_, index) => { const child = content[0].child(index); return child.mark(child.marks.filter(mark => mark.type !== s.marks.link)); })));
  }
  return s.nodes.list_item.create({ checked: token.task ? token.checked : null, href, todoId }, content);
}
function hasHTML(tokens) { return (tokens || []).some(token => token.type === 'html' || hasHTML(token.tokens)); }
function blocks(tokens) {
  return tokens.filter(token => token.type !== 'space' && token.type !== 'checkbox').map(token => {
    if (token.type !== 'code' && hasHTML(token.tokens)) return s.nodes.raw.create({ raw: token.raw });
    switch (token.type) {
      case 'paragraph': case 'text': return s.nodes.paragraph.create(null, inline(token.tokens || [{ type: 'text', text: token.text }]));
      case 'heading': return s.nodes.heading.create({ level: token.depth }, inline(token.tokens));
      case 'blockquote': { const content = blocks(token.tokens); return s.nodes.blockquote.create(null, content.length ? content : s.nodes.paragraph.create()); }
      case 'code': return s.nodes.code_block.create({ params: token.lang || '' }, token.text ? s.text(token.text) : null);
      case 'hr': return s.nodes.horizontal_rule.create();
      case 'list': return s.nodes[token.ordered ? 'ordered_list' : 'bullet_list'].create(token.ordered ? { order: token.start, tight: !token.loose } : { tight: !token.loose }, token.items.map(item));
      case 'table': {
        const row = (cells, header) => s.nodes.table_row.create(null, cells.map((cell, index) => s.nodes[header ? 'table_header' : 'table_cell'].create({ align: token.align[index] }, s.nodes.paragraph.create(null, inline(cell.tokens)))));
        return s.nodes.table.create(null, [row(token.header, true), ...token.rows.map(cells => row(cells, false))]);
      }
      default: return s.nodes.raw.create({ raw: token.raw });
    }
  });
}
export const markdownSerializer = new MarkdownSerializer({ ...defaultMarkdownSerializer.nodes,
  bullet_list(state, node) { state.renderList(node, '  ', () => '- '); },
  list_item(state, node) {
    if (node.attrs.checked === null) { state.renderContent(node); return; }
    state.write(`[${node.attrs.checked ? 'x' : ' '}] `);
    const label = node.firstChild.textContent;
    if (node.attrs.href && label.trim()) { state.write('['); state.renderInline(node.firstChild); state.write(`](${node.attrs.href})`); }
    else state.renderInline(node.firstChild);
    state.closeBlock(node.firstChild);
    node.forEach((child, _offset, index) => { if (index) state.render(child, node, index); });
  },
  raw(state, node) { state.write(node.attrs.raw); state.closeBlock(node); },
  table(state, node) {
    node.forEach((row, _offset, index) => {
      const cells = []; row.forEach(cell => { const value = markdownSerializer.serialize(cell); cells.push(value.replace(/\|/g, '\\|').replace(/\n/g, '<br>')); });
      state.write('| ' + cells.join(' | ') + ' |\n');
      if (index === 0) state.write('| ' + cells.map((_cell, column) => ({ left: ':---', right: '---:', center: ':---:' }[row.child(column).attrs.align] || '---')).join(' | ') + ' |\n');
    }); state.closeBlock(node);
  }
}, { ...defaultMarkdownSerializer.marks, strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true } });

export class MarkdownBridge {
  constructor(body) { this.original = body; this.sources = new Map(); this.doc = this.parse(body); }
  parse(body) {
    const tokens = globalThis.marked.lexer(body), result = []; let pending = '';
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index]; if (token.type === 'space') { pending += token.raw; continue; }
      const node = blocks([token])[0], key = 'source-' + index;
      const rooted = node.type.create({ ...node.attrs, sourceKey: key }, node.content, node.marks);
      let raw = pending + token.raw; pending = '';
      while (tokens[index + 1]?.type === 'space') raw += tokens[++index].raw;
      this.sources.set(key, { node: rooted, raw }); result.push(rooted);
    }
    return s.nodes.doc.create(null, result.length ? result : s.nodes.paragraph.create());
  }
  serialize(doc) {
    if (doc.eq(this.doc)) return this.original;
    let body = '';
    doc.forEach(node => {
      const original = this.sources.get(node.attrs.sourceKey);
      const raw = original?.node.eq(node) ? original.raw : markdownSerializer.serialize(s.nodes.doc.create(null, node));
      if (body && !body.endsWith('\n\n')) body += body.endsWith('\n') ? '\n' : '\n\n';
      body += raw;
    });
    return body.endsWith('\n') ? body : body + '\n';
  }
  // Adopt canonical task identities while retaining the unchanged source for all other blocks.
  remember(doc, body) {
    const parsed = new MarkdownBridge(body);
    if (doc.childCount !== parsed.doc.childCount) return;
    doc.forEach((node, _offset, index) => {
      const canonical = parsed.sources.get(parsed.doc.child(index).attrs.sourceKey);
      if (canonical && node.attrs.sourceKey) this.sources.set(node.attrs.sourceKey, { node, raw: canonical.raw });
    });
    this.doc = doc; this.original = body;
  }
}
export function taskPositions(doc) {
  const tasks = []; doc.descendants((node, position) => { if (node.type === s.nodes.list_item && node.attrs.checked !== null) tasks.push({ node, position }); }); return tasks;
}
