import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from 'prosemirror-state';
import { history, undo } from 'prosemirror-history';
import { MarkdownBridge } from '../prototype/rich-markdown.js';
import RichEditor from '../prototype/rich-editor.js';
import { slashTransaction } from '../prototype/slash-commands.js';

function run(id, source = '/command') {
  const bridge = new MarkdownBridge(source + '\n'), state = EditorState.create({ doc: bridge.doc, plugins: [history()] });
  const range = { from: 1, to: source.length + 1 };
  const transaction = slashTransaction(state, id, range);
  return { bridge, state, transaction, next: transaction && state.apply(transaction) };
}
test('slash block commands create schema-valid Markdown structures without retaining command text', () => {
  for (const [id, kind] of [['text', 'paragraph'], ['heading1', 'heading'], ['heading2', 'heading'], ['heading3', 'heading'], ['bullet', 'bullet_list'], ['numbered', 'ordered_list'], ['todo', 'bullet_list'], ['quote', 'blockquote'], ['code', 'code_block'], ['divider', 'horizontal_rule'], ['table', 'table']]) {
    const { bridge, next } = run(id);
    assert.ok(next, id); next.doc.check(); assert.equal(next.doc.firstChild.type.name, kind, id);
    assert.doesNotMatch(bridge.serialize(next.doc), /command/);
    if (id.startsWith('heading')) assert.equal(next.doc.firstChild.attrs.level, Number(id.at(-1)));
    if (id === 'todo') assert.equal(next.doc.firstChild.firstChild.attrs.checked, false);
    if (id === 'table') assert.equal(next.selection.$from.parent.type.name, 'paragraph');
  }
});
test('a slash conversion is one undoable edit and invalid choices preserve the source', () => {
  const { state, next } = run('heading2'); let restored;
  assert.equal(undo(next, transaction => { restored = next.apply(transaction); }), true);
  assert.ok(restored.doc.eq(state.doc));
  assert.equal(run('unknown').transaction, null);
  assert.equal(run('page').transaction, null);
});


test('/page prepares a link at the original query while preserving surrounding Markdown', () => {
  const bridge = new MarkdownBridge('# Parent\n\n/page\n\nText after the command.\n');
  const state = EditorState.create({ doc: bridge.doc }); let from;
  state.doc.descendants((node, position) => { if (node.isText && node.text === '/page') from = position; });
  const insert = RichEditor.prototype.pageInsertion.call({ view: { state }, bridge }, { from, to: from + 5 });
  const body = insert('New child', 'note-new.md');
  assert.match(body, /# Parent[\s\S]*\[New child\]\(note-new.md\)[\s\S]*Text after the command/);
  assert.doesNotMatch(body, /\/page/);
});
