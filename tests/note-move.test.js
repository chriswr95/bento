import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movableNote, noteDestination } from '../prototype/note-move.js';

function fixture() {
  return {
    home: 'home', records: { home: {}, note: {}, todo: { database: 'tasks' }, misplaced: {} },
    paths: { home: 'workspace.md', note: 'notes/note.md', todo: 'todos/task.md', misplaced: 'todos/stray.md' },
    databasePaths: { tasks: 'todos' }, folders: ['notes', 'archive', 'archive/old', 'todos', 'todos/nested', 'missing'],
    unavailableFolders: ['missing'], readOnlyRecords: []
  };
}
test('only regular editable notes can be dragged', () => {
  const workspace = fixture();
  assert.equal(movableNote(workspace, 'note'), true);
  for (const id of ['home', 'todo', 'misplaced', 'unknown']) assert.equal(movableNote(workspace, id), false);
  workspace.readOnlyRecords.push('note');
  assert.equal(movableNote(workspace, 'note'), false);
});
test('drop targets must be available regular folders, including root, outside the current parent', () => {
  const workspace = fixture();
  for (const folder of ['', 'archive', 'archive/old']) assert.equal(noteDestination(workspace, 'note', folder), true);
  for (const folder of ['notes', 'todos', 'todos/nested', 'missing', 'missing/child', 'unknown', '../outside', null]) assert.equal(noteDestination(workspace, 'note', folder), false);
  assert.equal(noteDestination(workspace, 'todo', 'archive'), false);
  workspace.unavailableFolders.push('notes');
  assert.equal(noteDestination(workspace, 'note', 'archive'), false);
});
