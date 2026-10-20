import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WorkspaceRepository } from '../files/repository.js';
import * as markdown from '../files/markdown.js';
import { trashPath } from '../files/trash-paths.js';
import model from '../prototype/workspace.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-trash-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp(new URL('../examples/document-databases', import.meta.url), root, { recursive: true });
  return WorkspaceRepository.open(root);
}
const task = 'todo-review-comments';

test('delete and restore retain exact file bytes, metadata and identity across restart', async t => {
  const repo = await fixture(t), filename = 'todos/todo-review-comments.md';
  const original = '\uFEFF' + (await fs.readFile(path.join(repo.root, filename), 'utf8')).replace('properties:', '# Keep this comment\ncustom: valuable\nproperties:').replace(/\r?\n/g, '\r\n');
  await fs.writeFile(path.join(repo.root, filename), original); await repo.reload();
  const result = await repo.deleteDocument(task);
  assert.equal(result.workspace.records[task], undefined); assert.equal(result.lastDeletion.token, result.deletion.token);
  await assert.rejects(fs.access(path.join(repo.root, filename)));
  const trash = await fs.readFile(path.join(repo.root, trashPath(result.deletion.token)), 'utf8');
  assert.equal(markdown.parse(trash).body, original);
  const restarted = await WorkspaceRepository.open(repo.root);
  assert.equal(restarted.lastDeletion.document, task); assert.equal(restarted.readOnly, false);
  const restored = await restarted.restoreDocument(restarted.lastDeletion.token);
  assert.equal(restored.restored.document, task); assert.equal(restored.lastDeletion, null);
  assert.equal(await fs.readFile(path.join(repo.root, filename), 'utf8'), original);
  assert.equal(restored.workspace.records[task].database, 'db-todos');
  await assert.rejects(fs.access(path.join(repo.root, trashPath(result.deletion.token))));
});

test('deleting a linked todo preserves source notes and never recaptures its missing link', async t => {
  const repo = await fixture(t), source = 'meetings/meeting-coordination.md', before = await fs.readFile(path.join(repo.root, source), 'utf8');
  await repo.deleteDocument(task);
  assert.equal(await fs.readFile(path.join(repo.root, source), 'utf8'), before);
  assert.ok(repo.errors.some(error => /Unresolved link/.test(error.message)));
  const next = model.applyEdit(repo.workspace, 'meeting-coordination', repo.workspace.records['meeting-coordination'].body + '\nFurther discussion\n').workspace;
  assert.equal(Object.keys(next.records).length, Object.keys(repo.workspace.records).length);
  await repo.save(next);
  assert.equal(repo.workspace.records[task], undefined);
  await repo.restoreDocument(repo.lastDeletion.token);
  assert.equal(repo.workspace.records[task].id, task);
});

test('project deletion retains relation identities and unrelated todo details', async t => {
  const repo = await fixture(t), todo = structuredClone(repo.workspace.records[task]);
  await repo.deleteDocument('project-creekside');
  assert.equal(repo.readOnly, false); assert.deepEqual(repo.workspace.records[task], todo);
  assert.equal(repo.workspace.records[task].properties['field-task-project'], 'project-creekside');
  await repo.restoreDocument(repo.lastDeletion.token);
  assert.equal(repo.workspace.records['project-creekside'].database, 'db-projects');
});

test('source deletion retains its separate todo and ordinary plain Markdown restores unchanged', async t => {
  const repo = await fixture(t);
  await repo.deleteDocument('meeting-coordination'); assert.ok(repo.workspace.records[task]);
  const filename = 'notes/PLAIN.MD', raw = '# Notes\n\nNo frontmatter is required.\n';
  await fs.writeFile(path.join(repo.root, filename), raw); await repo.reload();
  const id = Object.keys(repo.workspace.paths).find(id => repo.workspace.paths[id] === filename);
  await repo.deleteDocument(id); await repo.restoreDocument(repo.lastDeletion.token);
  assert.equal(await fs.readFile(path.join(repo.root, filename), 'utf8'), raw);
  assert.equal(repo.workspace.paths[id], filename);
});

test('workspace, schemas and unavailable records cannot be deleted through content IPC', async t => {
  const repo = await fixture(t);
  for (const id of [repo.workspace.home, 'db-todos', '../escape', 'missing']) await assert.rejects(repo.deleteDocument(id), /editable content/);
  await fs.unlink(path.join(repo.root, 'todos/database.md')); await repo.reload();
  await assert.rejects(repo.deleteDocument(task), /editable content/);
  // A missing schema does not block deleting unrelated ordinary notes.
  await repo.deleteDocument('note-scratch'); assert.equal(repo.workspace.records['note-scratch'], undefined);
});

test('external file changes stop deletion before any trash copy or unlink', async t => {
  const repo = await fixture(t), filename = path.join(repo.root, 'todos/todo-review-comments.md');
  await fs.appendFile(filename, '\nExternal changes\n');
  await assert.rejects(repo.deleteDocument(task), /changed on disk/);
  assert.match(await fs.readFile(filename, 'utf8'), /External changes/);
  await assert.rejects(fs.access(path.join(repo.root, '.bento-local/trash')));
});

test('restore refuses path and identity collisions without overwriting either version', async t => {
  const repo = await fixture(t), filename = path.join(repo.root, 'todos/todo-review-comments.md');
  const original = await fs.readFile(filename, 'utf8'); await repo.deleteDocument(task);
  const token = repo.lastDeletion.token;
  await fs.writeFile(filename, '# New independent file\n'); await repo.reload();
  await assert.rejects(repo.restoreDocument(token), /already exists/);
  assert.equal(await fs.readFile(filename, 'utf8'), '# New independent file\n');
  await fs.unlink(filename); await fs.writeFile(path.join(repo.root, 'todos/other.md'), original); await repo.reload();
  await assert.rejects(repo.restoreDocument(token), /identity already exists/);
  await fs.access(path.join(repo.root, trashPath(token)));
});

test('deletion and restoration recover after interruption in their final unlink', async t => {
  const repo = await fixture(t);
  repo.options.beforeWrite = entry => { if (entry.after === null) throw new Error('Interrupted unlink'); };
  await assert.rejects(repo.deleteDocument(task), /Interrupted unlink/);
  let reopened = await WorkspaceRepository.open(repo.root);
  assert.equal(reopened.workspace.records[task], undefined); assert.equal(reopened.readOnly, false);
  reopened.options.beforeWrite = repo.options.beforeWrite;
  await assert.rejects(reopened.restoreDocument(reopened.lastDeletion.token), /Interrupted unlink/);
  reopened = await WorkspaceRepository.open(repo.root);
  assert.ok(reopened.workspace.records[task]); assert.equal(reopened.lastDeletion, null); assert.equal(reopened.readOnly, false);
});

test('divergent interrupted deletion preserves both original work and the trash copy', async t => {
  const repo = await fixture(t), filename = path.join(repo.root, 'todos/todo-review-comments.md');
  repo.options.beforeWrite = entry => { if (entry.after === null) throw new Error('Interrupted'); };
  await assert.rejects(repo.deleteDocument(task), /Interrupted/);
  await fs.appendFile(filename, '\nNew external work\n');
  const reopened = await WorkspaceRepository.open(repo.root);
  assert.equal(reopened.readOnly, true); assert.match(await fs.readFile(filename, 'utf8'), /New external work/);
  assert.equal((await fs.readdir(path.join(repo.root, '.bento-local/trash'))).length, 1);
});

test('malformed trash paths, identities and original locations cannot escape the workspace', async t => {
  const repo = await fixture(t); await repo.deleteDocument(task);
  for (const token of ['../escape', '', null, 'not-a-token']) await assert.rejects(repo.restoreDocument(token), /Invalid deleted-file identity/);
  const token = repo.lastDeletion.token, filename = path.join(repo.root, trashPath(token)), raw = await fs.readFile(filename, 'utf8');
  for (const target of ['../outside.md', '.hidden.md', 'workspace.md', 'todos/database.md']) {
    const parsed = markdown.parse(raw); parsed.metadata.path = target;
    await fs.writeFile(filename, '---\n' + JSON.stringify(parsed.metadata) + '\n---\n' + parsed.body);
    await assert.rejects(repo.restoreDocument(token));
  }
  await fs.writeFile(filename, raw);
  const broken = markdown.parse(raw); broken.metadata.document = 'another-id';
  await fs.writeFile(filename, '---\n' + JSON.stringify(broken.metadata) + '\n---\n' + broken.body);
  await assert.rejects(repo.restoreDocument(token), /identity changed/);
});

test('restoration follows the most recent remaining deletion after repeated restarts', async t => {
  const repo = await fixture(t); const first = await repo.deleteDocument('note-scratch'); await repo.deleteDocument(task);
  const reopened = await WorkspaceRepository.open(repo.root); assert.equal(reopened.lastDeletion.document, task);
  await reopened.restoreDocument(reopened.lastDeletion.token);
  assert.equal(reopened.lastDeletion.token, first.deletion.token);
  await reopened.restoreDocument(reopened.lastDeletion.token);
  assert.equal(reopened.lastDeletion, null);
});
test('restore refuses newly required schema values while retaining the deleted file', async t => {
  const repo = await fixture(t); await repo.deleteDocument(task); const token = repo.lastDeletion.token;
  const filename = path.join(repo.root, 'todos/database.md'), parsed = markdown.parse(await fs.readFile(filename, 'utf8'));
  parsed.document.addIn(['fields'], { id: 'required-detail', name: 'Required detail', type: 'text', required: true });
  await fs.writeFile(filename, '---\n' + parsed.document.toString() + '---\n' + parsed.body); await repo.reload();
  await assert.rejects(repo.restoreDocument(token), /Required detail|required/i);
  await fs.access(path.join(repo.root, trashPath(token)));
  await assert.rejects(fs.access(path.join(repo.root, 'todos/todo-review-comments.md')));
});
test('trash-directory symlinks cannot redirect a deletion outside the workspace', async t => {
  const repo = await fixture(t), outside = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-outside-trash-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.mkdir(path.join(repo.root, '.bento-local'), { recursive: true });
  try { await fs.symlink(outside, path.join(repo.root, '.bento-local/trash'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') return t.skip('Windows symlink privilege unavailable'); throw error; }
  await assert.rejects(repo.deleteDocument(task), /Symbolic links/);
  await fs.access(path.join(repo.root, 'todos/todo-review-comments.md'));
  assert.deepEqual(await fs.readdir(outside), []);
});
