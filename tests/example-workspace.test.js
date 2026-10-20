import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { create, WorkspaceRepository } from '../files/repository.js';
import model from '../prototype/workspace.js';
import Walkthrough from '../prototype/walkthrough.js';

async function folder(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-example-'));
  t.after(() => fs.rm(root, { recursive: true, force: true })); return root;
}
test('example uses ordinary editable documents, relative local dates and connected checkbox todos', async t => {
  const root = await folder(t);
  let repo = await create(root, 'Bento example', { example: true, today: new Date(2026, 11, 30, 12) });
  assert.deepEqual(repo.errors, []);
  assert.equal(model.activeProjects(repo.workspace).length, 2);
  const tasks = model.allTasks(repo.workspace);
  assert.equal(tasks.length, 4); assert.equal(tasks.filter(task => task.done).length, 1);
  assert.deepEqual(tasks.filter(task => task.due).map(task => task.due).sort(), ['2026-12-30', '2027-01-02']);
  const { project, meeting } = repo.view().walkthrough;
  assert.equal(model.projectOf(repo.workspace, repo.workspace.records[meeting]), project);
  assert.equal(tasks.every(task => task.project), true);
  const added = model.applyEdit(repo.workspace, meeting, repo.workspace.records[meeting].body + '\n- [ ] My next action\n').workspace;
  await repo.save(added);
  repo = await WorkspaceRepository.open(root);
  assert.equal(model.allTasks(repo.workspace).length, 5);
  assert.deepEqual(repo.errors, []);
  const task = model.allTasks(repo.workspace).find(item => item.title === 'My next action');
  assert.equal(task.project, project);
  assert.ok(await fs.readFile(path.join(root, repo.workspace.paths[task.id]), 'utf8'));
  await repo.save(model.updateTodo(repo.workspace, task.id, { done: true }));
  assert.match(repo.workspace.records[meeting].body, /\[x\] \[My next action\]/);
  assert.equal(repo.view().walkthrough.meeting, meeting);
});
test('example creation refuses existing folders; empty workspaces remain empty', async t => {
  const root = await folder(t), repo = await create(root);
  assert.equal(Object.keys(repo.workspace.records).filter(id => id !== repo.workspace.home).length, 0);
  assert.equal(repo.view().walkthrough, null);
  const before = await fs.readFile(path.join(root, 'workspace.md'), 'utf8');
  await assert.rejects(create(root, 'Example', { example: true }), /empty folder/);
  assert.equal(await fs.readFile(path.join(root, 'workspace.md'), 'utf8'), before);
});
test('walkthrough progress is personal, replayable and tolerates unavailable storage', () => {
  const view = { walkthrough: { version: 1, project: 'p', meeting: 'm' }, workspace: { records: { p: {}, m: {} } } };
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const guide = new Walkthrough(view, storage);
  assert.equal(guide.location().document, 'p'); guide.next();
  assert.equal(new Walkthrough(view, storage).location().document, 'm');
  guide.next(); assert.equal(guide.location().view, 'daily'); guide.next();
  assert.equal(new Walkthrough(view, storage).active, false);
  guide.replay(); assert.equal(guide.active, true); assert.equal(guide.step, 0);
  const blocked = new Walkthrough(view, { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  blocked.dismiss(); assert.equal(blocked.active, false);
  assert.equal(new Walkthrough({ walkthrough: null, workspace: { records: {} } }, storage).active, false);
});
