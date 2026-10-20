import { fileURLToPath } from 'node:url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WorkspaceRepository, create } from '../files/repository.js';
import * as markdown from '../files/markdown.js';
import model from '../prototype/workspace.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-files-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp(path.join(__dirname, '..', 'examples', 'document-databases'), root, { recursive: true });
  return root;
}
const edit = (repo, text) => model.applyEdit(repo.workspace, 'meeting-coordination', repo.workspace.records['meeting-coordination'].body + text).workspace;

test('open is read-only; capture writes a todo and relative link; status and notes survive reopen', async t => {
  const root = await fixture(t), before = await fs.readFile(path.join(root, 'meetings/meeting-coordination.md'), 'utf8');
  const repo = await WorkspaceRepository.open(root);
  assert.deepEqual(repo.errors, []);
  assert.equal(await fs.readFile(path.join(root, 'meetings/meeting-coordination.md'), 'utf8'), before);
  let next = edit(repo, '\n- [ ] New action\n');
  const task = model.allTasks(next).find(task => task.title === 'New action');
  assert.match(next.records['meeting-coordination'].body, new RegExp(`../todos/${task.id}.md`));
  await repo.save(next);
  let reopened = await WorkspaceRepository.open(root);
  assert.equal(reopened.workspace.records[task.id].database, 'db-todos');
  const raw = await fs.readFile(path.join(root, `todos/${task.id}.md`), 'utf8');
  assert.doesNotMatch(raw, /^database:/m);
  next = model.applyEdit(reopened.workspace, task.id, '# My working notes\n\nKeep this detail.').workspace;
  next = model.updateTodo(next, task.id, { status: 'option-started', due: '2026-11-02' });
  assert.equal(model.taskInfo(next, next.records[task.id]).done, false);
  await reopened.save(next);
  reopened = await WorkspaceRepository.open(root);
  assert.match(reopened.workspace.records[task.id].body, /Keep this detail/);
  assert.equal(reopened.workspace.records[task.id].properties['field-task-status'], 'option-started');
  await reopened.save(model.updateTodo(reopened.workspace, task.id, { done: true }));
  reopened = await WorkspaceRepository.open(root);
  assert.match(reopened.workspace.records['meeting-coordination'].body, /\[x\] \[New action\]/);
  assert.ok((await fs.readdir(path.join(root, '.bento-local/history'))).length >= 3);
});

test('external changes prevent the entire save and preserve the external file', async t => {
  const root = await fixture(t), repo = await WorkspaceRepository.open(root);
  const filename = path.join(root, 'meetings/meeting-coordination.md');
  const external = (await fs.readFile(filename, 'utf8')) + '\nExternal notes\n';
  await fs.writeFile(filename, external);
  await assert.rejects(repo.save(edit(repo, '\n- [ ] Local action\n')), /changed on disk/);
  assert.equal(await fs.readFile(filename, 'utf8'), external);
  assert.equal((await fs.readdir(path.join(root, 'todos'))).length, 2);
});

test('interrupted multi-file save recovers allocated IDs once and preserves backups', async t => {
  const root = await fixture(t);
  let count = 0;
  const repo = await WorkspaceRepository.open(root, { beforeWrite() { if (++count === 2) throw new Error('Simulated interruption'); } });
  const next = edit(repo, '\n- [ ] Recover this action\n');
  const task = model.allTasks(next).find(task => task.title === 'Recover this action');
  await assert.rejects(repo.save(next), /Simulated interruption/);
  assert.ok(await fs.readFile(path.join(root, '.bento-local/pending.json')));
  const recovered = await WorkspaceRepository.open(root);
  assert.deepEqual(recovered.errors, []);
  assert.equal(recovered.workspace.records[task.id].title, 'Recover this action');
  assert.match(recovered.workspace.records['meeting-coordination'].body, new RegExp(task.id));
  assert.equal(model.allTasks(recovered.workspace).filter(task => task.title === 'Recover this action').length, 1);
  await assert.rejects(fs.access(path.join(root, '.bento-local/pending.json')));
});

test('recovery preserves a conflicting external edit and opens read-only', async t => {
  const root = await fixture(t);
  const repo = await WorkspaceRepository.open(root, { beforeWrite(entry) { if (entry.before !== null) throw new Error('Interrupted'); } });
  await assert.rejects(repo.save(edit(repo, '\n- [ ] Pending action\n')), /Interrupted/);
  const filename = path.join(root, 'meetings/meeting-coordination.md');
  await fs.appendFile(filename, '\nExternal change after interruption\n');
  const external = await fs.readFile(filename, 'utf8');
  const reopened = await WorkspaceRepository.open(root);
  assert.equal(reopened.readOnly, true);
  assert.match(reopened.errors[0].message, /Recovery conflict/);
  assert.equal(await fs.readFile(filename, 'utf8'), external);
  await assert.rejects(reopened.save(reopened.workspace), /needs repair/);
});

test('unknown metadata, comments, body syntax, and line endings survive a small edit', async t => {
  const root = await fixture(t), filename = path.join(root, 'todos/todo-review-comments.md');
  let raw = await fs.readFile(filename, 'utf8');
  raw = raw.replace('properties:', '# Keep this comment\ncustom_setting: {nested: [one, two]}\nproperties:\n  unknown-field: valuable # Keep property comment');
  raw = raw.replace(/\r?\n/g, '\r\n');
  await fs.writeFile(filename, raw);
  const repo = await WorkspaceRepository.open(root);
  await repo.save(model.updateTodo(repo.workspace, 'todo-review-comments', { done: true }));
  const saved = await fs.readFile(filename, 'utf8');
  assert.match(saved, /# Keep this comment/);
  assert.match(saved, /# Keep property comment/);
  assert.deepEqual(markdown.parse(saved).metadata.custom_setting, { nested: ['one', 'two'] });
  assert.equal(markdown.parse(saved).metadata.properties['unknown-field'], 'valuable');
  assert.equal(saved.replace(/\r\n/g, '').includes('\n'), false);
});

test('folders define membership, subfolders inherit it, and incompatible transfers preserve values', async t => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root, 'todos/Review'));
  await fs.rename(path.join(root, 'todos/todo-review-comments.md'), path.join(root, 'todos/Review/todo-review-comments.md'));
  let repo = await WorkspaceRepository.open(root);
  assert.equal(repo.workspace.records['todo-review-comments'].database, 'db-todos');
  await fs.rename(path.join(root, 'todos/Review/todo-review-comments.md'), path.join(root, 'projects/todo-review-comments.md'));
  repo = await WorkspaceRepository.open(root);
  assert.equal(repo.workspace.records['todo-review-comments'].database, 'db-projects');
  assert.equal(repo.workspace.records['todo-review-comments'].properties['field-task-status'], 'option-open');
  assert.ok(repo.errors.some(error => /Unresolved link/.test(error.message)));
});

test('duplicate keys and identities are reported without rewriting files', async t => {
  const root = await fixture(t), filename = path.join(root, 'todos/todo-review-comments.md');
  const raw = await fs.readFile(filename, 'utf8');
  await fs.writeFile(filename, raw.replace('id: todo-review-comments', 'id: todo-review-comments\nid: ambiguous'));
  let repo = await WorkspaceRepository.open(root);
  assert.ok(repo.errors.some(error => /unique/i.test(error.message)));
  assert.equal(repo.workspace.records['todo-review-comments'], undefined);
  await fs.writeFile(filename, raw);
  await fs.writeFile(path.join(root, 'todos/copy.md'), raw);
  repo = await WorkspaceRepository.open(root);
  assert.equal(repo.readOnly, true);
  assert.ok(repo.errors.some(error => /Duplicate document ID/.test(error.message)));
});

test('path traversal, symlinks, and case-colliding files are rejected', async t => {
  const root = await fixture(t);
  const manifestFile = path.join(root, 'workspace.md'), raw = await fs.readFile(manifestFile, 'utf8');
  await fs.writeFile(manifestFile, raw.replace('path: todos', 'path: ../outside'));
  await assert.rejects(WorkspaceRepository.open(root), /portable workspace path/);
  await fs.writeFile(manifestFile, raw);
  const symlink = path.join(root, 'linked.md');
  try { await fs.symlink(manifestFile, symlink); }
  catch (error) { if (process.platform === 'win32' && error.code === 'EPERM') return t.skip('Windows symlink privilege unavailable'); throw error; }
  await assert.rejects(WorkspaceRepository.open(root), /Symbolic links/);
});

test('renderer cannot forge paths, change schemas, or delete records', async t => {
  const root = await fixture(t), repo = await WorkspaceRepository.open(root);
  const forged = edit(repo, '\nExtra notes\n'); forged.paths['meeting-coordination'] = '../outside.md';
  await repo.save(forged);
  assert.equal(repo.workspace.paths['meeting-coordination'], 'meetings/meeting-coordination.md');
  const schemas = model.clone(repo.workspace); schemas.databases['db-todos'].title = 'Changed';
  await assert.rejects(repo.save(schemas), /Schema changes/);
  const deletion = model.clone(repo.workspace); delete deletion.records['meeting-coordination'];
  await assert.rejects(repo.save(deletion), /Deleting documents/);
});

test('new workspaces use folder definitions and creation refuses a populated folder', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-create-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repo = await create(root, 'Test workspace');
  assert.equal(repo.info.title, 'Test workspace');
  assert.equal(repo.workspace.defaultTaskDatabase, 'db-todos');
  assert.deepEqual(repo.errors, []);
  assert.deepEqual(repo.workspace.records, {});
  await assert.rejects(create(root), /empty folder/);
});


test('database folder names with spaces, parentheses and Unicode produce portable links', async t => {
  const root = await fixture(t), folder='My todos (工程)';
  await fs.rename(path.join(root,'todos'), path.join(root,folder));
  const file=path.join(root,'workspace.md');
  await fs.writeFile(file,(await fs.readFile(file,'utf8')).replace('path: todos','path: '+folder));
  const repo=await WorkspaceRepository.open(root);
  const next=edit(repo,'\n- [ ] Action in renamed folder\n');
  const task=model.allTasks(next).find(task=>task.title==='Action in renamed folder');
  assert.equal(model.parse(next.records['meeting-coordination'].body).tasks.at(-1).todoId, task.id);
  assert.match(next.records['meeting-coordination'].body, /My%20todos%20%28/);
  await repo.save(next);
  const reopened=await WorkspaceRepository.open(root);
  assert.equal(reopened.workspace.records[task.id].title,'Action in renamed folder');
  assert.ok(await fs.readFile(path.join(root,folder,task.id+'.md')));
});


test('new project and meeting documents persist their identity, defaults and project relationship', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-new-documents-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repo = await create(root, 'Personal workspace');
  const project = model.createDocument(repo.workspace, { database: 'db-projects', title: 'My project' });
  await repo.save(project.workspace);
  const meeting = model.createDocument(repo.workspace, { database: 'db-meetings', title: 'Kickoff', properties: { 'field-meeting-projects': [project.documentId] } });
  await repo.save(meeting.workspace);
  const reopened = await WorkspaceRepository.open(root);
  assert.deepEqual(reopened.errors, []);
  assert.equal(model.activeProjects(reopened.workspace)[0].id, project.documentId);
  assert.equal(model.projectOf(reopened.workspace, reopened.workspace.records[meeting.documentId]), project.documentId);
  assert.match(await fs.readFile(path.join(root, 'projects', project.documentId + '.md'), 'utf8'), /# My project/);
});


test('project and meeting property edits survive reopening without rewriting Markdown bodies', async t => {
  const root = await fixture(t), repo = await WorkspaceRepository.open(root);
  const project = repo.workspace.records['project-creekside'], meeting = repo.workspace.records['meeting-coordination'];
  let next = model.updateDocument(repo.workspace, project.id, { tags: ['Civil engineering', 'client, internal'], properties: { 'field-project-status': 'option-archived' } });
  next = model.updateDocument(next, meeting.id, { properties: { 'field-meeting-date': '2026-10-20', 'field-meeting-projects': [] } });
  await repo.save(next);
  const reopened = await WorkspaceRepository.open(root);
  assert.deepEqual(reopened.errors, []);
  assert.deepEqual(reopened.workspace.records[project.id].tags, ['Civil engineering', 'client, internal']);
  assert.equal(reopened.workspace.records[project.id].properties['field-project-status'], 'option-archived');
  assert.equal(reopened.workspace.records[meeting.id].properties['field-meeting-date'], '2026-10-20');
  assert.deepEqual(reopened.workspace.records[meeting.id].properties['field-meeting-projects'], []);
  assert.equal(reopened.workspace.records[project.id].body, project.body);
  assert.equal(reopened.workspace.records[meeting.id].body, meeting.body);
});

test('document and global tag colors persist in Markdown while workspace comments and bodies survive', async t => {
  const root = await fixture(t), workspaceFile = path.join(root, 'workspace.md');
  const original = (await fs.readFile(workspaceFile, 'utf8')).replace('title:', '# Keep workspace comment\ncustom_note: retained\ntitle:');
  await fs.writeFile(workspaceFile, original);
  const repo = await WorkspaceRepository.open(root);
  let next = model.updateDocument(repo.workspace, 'project-creekside', { color: 'purple' });
  next = model.updateTagColor(next, 'Civil engineering', 'teal');
  next = model.updateTagColor(next, '__proto__', 'pink');
  await repo.save(next);
  const reopened = await WorkspaceRepository.open(root);
  assert.equal(reopened.workspace.records['project-creekside'].color, 'purple');
  assert.equal(reopened.workspace.tagColors['Civil engineering'], 'teal');
  assert.equal(reopened.workspace.tagColors.__proto__, 'pink');
  const saved = await fs.readFile(workspaceFile, 'utf8');
  assert.match(saved, /# Keep workspace comment/); assert.equal(markdown.parse(saved).metadata.custom_note, 'retained');
  assert.equal(markdown.parse(saved).body, markdown.parse(original).body);
  await reopened.save(model.updateTagColor(reopened.workspace, 'Civil engineering', null));
  assert.equal(Object.hasOwn((await WorkspaceRepository.open(root)).workspace.tagColors, 'Civil engineering'), false);
});

test('tag color saves refuse external workspace edits and preserve both representations', async t => {
  const root = await fixture(t), repo = await WorkspaceRepository.open(root), filename = path.join(root, 'workspace.md');
  const next = model.updateTagColor(repo.workspace, 'Follow up', 'red');
  await fs.appendFile(filename, '\nExternal workspace note\n');
  await assert.rejects(repo.save(next), /changed on disk/);
  assert.match(await fs.readFile(filename, 'utf8'), /External workspace note/);
  assert.equal(next.tagColors['Follow up'], 'red');
});
