import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from 'prosemirror-state';
import { MarkdownBridge, taskPositions } from '../prototype/rich-markdown.js';
import model from '../prototype/workspace.js';

const sample = '# Meeting\n\nA **bold** paragraph with *emphasis*, ~~strike~~ and `code`.\n\n- [ ] [Review](todo-review.md)\n  - [x] Child\n\n> Quoted note\n\n```md\n- [ ] Code sample\n```\n\n| Column | Value |\n| :--- | ---: |\n| A | B |\n\n<!-- Keep exact comment -->\n';
test('rich document opens without changing Markdown bytes or creating source inputs', () => {
  const bridge = new MarkdownBridge(sample);
  assert.equal(bridge.serialize(bridge.doc), sample);
  assert.equal(bridge.doc.firstChild.type.name, 'heading');
  assert.equal(taskPositions(bridge.doc).length, 2);
  assert.equal(bridge.doc.toJSON().content.some(node => node.type === 'table'), true);
});
test('editing one paragraph retains other block sources including comments, code and list syntax', () => {
  const body = 'A paragraph.\n\n*   [ ] [Existing](todo-existing.md)\n\n~~~js\nconst x = 1;\n~~~\n\n<!--exact-->\n';
  const bridge = new MarkdownBridge(body), state = EditorState.create({ doc: bridge.doc });
  const changed = state.apply(state.tr.insertText(' new', 2));
  const saved = bridge.serialize(changed.doc);
  assert.match(saved, /new/);
  assert.ok(saved.includes('*   [ ] [Existing](todo-existing.md)\n'));
  assert.ok(saved.includes('~~~js\nconst x = 1;\n~~~'));
  assert.ok(saved.includes('<!--exact-->'));
});
test('task edits serialize one identity, completion and nested task structure', () => {
  const bridge = new MarkdownBridge('- [ ] [Review](todo-review.md)\n  - [ ] Nested\n');
  const { position, node } = taskPositions(bridge.doc)[0];
  const state = EditorState.create({ doc: bridge.doc });
  const next = state.apply(state.tr.setNodeMarkup(position, null, { ...node.attrs, checked: true }).insertText(' updated', position + 2 + node.firstChild.content.size));
  const parsed = model.parse(bridge.serialize(next.doc));
  assert.equal(parsed.tasks[0].todoId, 'todo-review'); assert.equal(parsed.tasks[0].title, 'Review updated'); assert.equal(parsed.tasks[0].done, true);
  assert.equal(parsed.tasks[1].title, 'Nested');
});
test('new task source creates one record and canonical identity can be adopted without rewriting its body notes', () => {
  let workspace = model.createWorkspace({ coordination: '# Meeting\n', drainage: '# Drainage\n' });
  const bridge = new MarkdownBridge('- [ ] Follow up\n');
  workspace = model.applyEdit(workspace, 'coordination', bridge.serialize(bridge.doc)).workspace;
  const task = model.allTasks(workspace)[0]; assert.equal(task.title, 'Follow up');
  assert.equal(model.parse(workspace.records.coordination.body).tasks[0].todoId, task.id);
});
test('rich marks and code text survive serialization while code checkboxes remain examples', () => {
  const bridge = new MarkdownBridge('**Bold** and *italic* with `&amp;`.\n\n```\n- [ ] Code only\n```\n');
  assert.equal(taskPositions(bridge.doc).length, 0);
  const code = []; bridge.doc.descendants(node => { if (node.isText && node.marks.some(mark => mark.type.name === 'code')) code.push(node.text); });
  assert.deepEqual(code, ['&amp;']);
});
test('unknown and HTML blocks are preserved as non-executable atoms', () => {
  const source = '<script>alert("unsafe")</script>\n\nPlain paragraph.\n';
  const bridge = new MarkdownBridge(source); assert.equal(bridge.doc.firstChild.type.name, 'raw');
  assert.equal(bridge.doc.firstChild.attrs.raw, '<script>alert("unsafe")</script>\n\n');
  assert.equal(bridge.serialize(bridge.doc), source);
});

test('formatted todo labels keep plain record titles and retain formatting through completion and reopen', () => {
  let workspace = model.createWorkspace({ coordination: '- [ ] **Review** the *drawings*\n', drainage: '# Drainage\n' });
  const task = model.allTasks(workspace)[0]; assert.equal(task.title, 'Review the drawings');
  assert.match(workspace.records.coordination.body, /\[\*\*Review\*\* the \*drawings\*\]/);
  workspace = model.updateTodo(workspace, task.id, { done: true });
  const body = workspace.records.coordination.body;
  assert.match(body, /- \[x\] \[\*\*Review\*\*/);
  const bridge = new MarkdownBridge(body), first = taskPositions(bridge.doc)[0].node;
  assert.equal(first.firstChild.firstChild.marks[0].type.name, 'strong');
  assert.equal(bridge.serialize(bridge.doc), body);
});
test('editing an aligned table preserves alignment and rich cell contents', () => {
  const bridge = new MarkdownBridge('| Left | Right |\n| :--- | ---: |\n| A | **B** |\n');
  let position = 0; bridge.doc.descendants((node, pos) => { if (node.isText && node.text === 'A') position = pos; });
  const state = EditorState.create({ doc: bridge.doc }), changed = state.apply(state.tr.insertText('more ', position));
  const saved = bridge.serialize(changed.doc);
  assert.match(saved, /:--- \| ---:/); assert.match(saved, /\*\*B\*\*/); assert.match(saved, /more A/);
});

test('task HTML serialization carries completion and stable identity for rich clipboard pastes', () => {
  const bridge = new MarkdownBridge('- [x] [Review](todo-review.md)\n');
  const task = taskPositions(bridge.doc)[0].node;
  const dom = task.type.spec.toDOM(task);
  assert.equal(dom[1]['data-bento-checked'], 'true');
  assert.equal(dom[1]['data-bento-href'], 'todo-review.md');
});

test('loose task lists never include checkbox source markers in visible labels', () => {
  const bridge = new MarkdownBridge('- [x] [Review](todo-review.md)\n\n- [ ] [Follow up](todo-follow.md)\n');
  const items = taskPositions(bridge.doc);
  assert.deepEqual(items.map(item => item.node.firstChild.textContent), ['Review', 'Follow up']);
  assert.deepEqual(items.map(item => item.node.attrs.todoId), ['todo-review', 'todo-follow']);
});
