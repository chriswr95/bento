import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directoryTree, DirectoryState } from '../prototype/directory-tree.js';

const workspace = () => ({
  databases: { projects: { id: 'projects', title: 'Projects', capabilities: { project: {} } }, todos: { id: 'todos', title: 'Todos', capabilities: { task: {} } } },
  folders: ['projects', 'projects/Design', 'todos'],
  records: { alpha: { id: 'alpha', title: 'Alpha' }, beta: { id: 'beta', title: 'Beta' }, loose: { id: 'loose', title: 'Workspace notes' } },
  paths: { alpha: 'projects/Design/alpha.md', beta: 'projects/beta.md', loose: 'notes.md' }
});

test('directory navigation mirrors nested paths, includes empty folders and lists each document once', () => {
  const input = workspace(), before = structuredClone(input), tree = directoryTree(input);
  assert.deepEqual(tree.folders.map(folder => folder.path), ['projects', 'todos']);
  const projects = tree.folders[0];
  assert.equal(projects.database, undefined);
  assert.deepEqual(projects.documents.map(doc => doc.id), ['beta']);
  assert.equal(projects.folders[0].path, 'projects/Design');
  assert.deepEqual(projects.folders[0].documents, [{ id: 'alpha', title: 'Alpha', path: 'projects/Design/alpha.md' }]);
  assert.deepEqual(tree.folders[1].documents, []);
  assert.equal(tree.documents[0].id, 'loose');
  assert.deepEqual(input, before);
});

test('folder names such as __proto__ stay ordinary paths and duplicate document titles remain distinct', () => {
  const input = workspace(); input.paths.alpha = 'projects/__proto__/alpha.md'; input.paths.beta = 'projects/__proto__/beta.md';
  input.records.alpha.title = input.records.beta.title = 'Review';
  const tree = directoryTree(input);
  assert.deepEqual(tree.folders[0].folders[0].documents.map(doc => doc.id), ['alpha', 'beta']);
});

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('collapse preferences survive a new navigation instance and remain workspace-specific', () => {
  const saved = storage(), first = new DirectoryState('workspace-a', saved);
  first.set('projects', false);
  assert.equal(new DirectoryState('workspace-a', saved).expanded('projects'), false);
  assert.equal(new DirectoryState('workspace-b', saved).expanded('projects'), true);
});

test('revealing a page expands all its ancestors and preserves unrelated collapsed folders', () => {
  const state = new DirectoryState('workspace', storage());
  for (const path of ['', 'projects', 'projects/Design', 'todos']) state.set(path, false);
  state.reveal('projects/Design/review.md');
  for (const path of ['', 'projects', 'projects/Design']) assert.equal(state.expanded(path), true);
  assert.equal(state.expanded('todos'), false);
});

test('malformed or unavailable settings never prevent navigation', () => {
  for (const value of ['{', '[]', '{"projects":"yes"}']) {
    const state = new DirectoryState('workspace', { getItem: () => value, setItem() {} });
    assert.equal(state.expanded('projects', false), false);
  }
  const state = new DirectoryState('workspace', { getItem() { throw new Error('Unavailable'); }, setItem() { throw new Error('Unavailable'); } });
  state.set('projects', false); state.reveal('projects/review.md');
  assert.equal(state.expanded('projects'), true);
});


test('collapse all persists every folder and reveal reopens only the selected path', () => {
  const saved = storage(), state = new DirectoryState('workspace', saved);
  const paths = ['projects', 'projects/Design', 'todos'];
  state.collapse(paths);
  const restored = new DirectoryState('workspace', saved);
  for (const path of paths) assert.equal(restored.expanded(path), false);
  restored.reveal('projects/Design/review.md');
  assert.equal(restored.expanded('projects'), true);
  assert.equal(restored.expanded('projects/Design'), true);
  assert.equal(restored.expanded('todos'), false);
});
