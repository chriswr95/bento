import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection } from 'prosemirror-state';
import { MarkdownBridge } from '../prototype/rich-markdown.js';
import { indentCode, indentList } from '../prototype/editor-indent.js';

function editor(markdown) {
  const bridge = new MarkdownBridge(markdown);
  let state = EditorState.create({ doc: bridge.doc });
  return {
    select(from, to = from) { state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to))); },
    run(command) { return command(state, tr => { state = state.apply(tr); }); },
    get state() { return state; }, get body() { return bridge.serialize(state.doc); }
  };
}
test('code indentation inserts two spaces and outdents selected lines, retaining selection', () => {
  const view = editor('```js\none\n two\n```\n');
  view.select(1, 9); assert.equal(view.run(indentCode()), true);
  assert.equal(view.state.doc.firstChild.textContent, '  one\n   two');
  view.run(indentCode(true)); assert.equal(view.state.doc.firstChild.textContent, 'one\n two');
  view.select(2); view.run(indentCode()); assert.equal(view.state.doc.firstChild.textContent, 'o  ne\n two');
  assert.equal(view.state.selection.from, 4);
});
test('outdent handles tabs and partial space prefixes without changing unindented text', () => {
  const view = editor('```\n\tfirst\n second\nlast\n```\n');
  view.select(1, view.state.doc.content.size - 1); view.run(indentCode(true));
  assert.equal(view.state.doc.firstChild.textContent, 'first\nsecond\nlast');
  view.run(indentCode(true)); assert.equal(view.state.doc.firstChild.textContent, 'first\nsecond\nlast');
});
test('lists nest and outdent while root items remain lists and unrelated paragraphs keep native Tab', () => {
  const view = editor('- First\n- Second\n');
  let second; view.state.doc.descendants((node, position) => { if (node.isText && node.text === 'Second') second = position; });
  view.select(second); view.run(indentList()); assert.match(view.body, /\n {2}- Second/);
  view.run(indentList(true)); assert.match(view.body, /\n- Second/);
  view.run(indentList(true)); assert.match(view.body, /\n- Second/);
  const paragraph = editor('Ordinary text\n'); paragraph.select(1);
  assert.equal(paragraph.run(indentCode()), false); assert.equal(paragraph.run(indentList()), false);
});
