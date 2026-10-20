import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WorkspaceRepository, create } from '../files/repository.js';
import model from '../prototype/workspace.js';
import { directoryTree } from '../prototype/directory-tree.js';
import { resolvePageLink } from '../prototype/page-links.js';
import { moveLinks } from '../files/move-links.js';

async function fixture(t, options) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-organization-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp(new URL('../examples/document-databases', import.meta.url), root, { recursive: true });
  return WorkspaceRepository.open(root, options);
}
test('opening the current layout does not rewrite content or offer an upgrade operation', async t => {
  const repo = await fixture(t), before = new Map(repo.files);
  assert.equal(repo.readOnly, false); assert.equal(repo.upgrade, undefined);
  assert.equal(Object.hasOwn(repo.view(), 'needsUpgrade'), false);
  await repo.reload(); assert.deepEqual(repo.files, before);
});
test('unsupported development layouts fail without migrating or rewriting files', async t => {
  const repo = await fixture(t), filename = path.join(repo.root, 'workspace.md');
  const older = (await fs.readFile(filename, 'utf8')).replace('organization_version: 2\n', '');
  await fs.writeFile(filename, older);
  await assert.rejects(WorkspaceRepository.open(repo.root), /Unsupported workspace organization/);
  assert.equal(await fs.readFile(filename, 'utf8'), older);
  await assert.rejects(fs.access(path.join(repo.root, '.bento-local/pending.json')));
});
test('database membership follows metadata across mixed folders and new ordinary pages default to notes', async t => {
  const repo = await fixture(t); await repo.createFolder('projects', 'Drainage');
  const ordinary = model.createDocument(repo.workspace, { database: null, title: 'Musings', folder: 'projects/Drainage' });
  await repo.save(ordinary.workspace);
  assert.equal(repo.workspace.records[ordinary.documentId].database, undefined);
  assert.equal(repo.workspace.paths[ordinary.documentId], `projects/Drainage/${ordinary.documentId}.md`);
  const project = model.createDocument(repo.workspace, { database: 'db-projects', title: 'Project anywhere', folder: 'notes' });
  await repo.save(project.workspace);
  const task = 'todo-review-comments'; await repo.moveDocument(task, 'projects/Drainage');
  const reopened = await WorkspaceRepository.open(repo.root);
  assert.equal(reopened.workspace.records[task].database, 'db-todos');
  assert.equal(reopened.workspace.records[project.documentId].database, 'db-projects');
  assert.equal(reopened.workspace.records[ordinary.documentId].database, undefined);
  const generic = model.createDocument(reopened.workspace, { database: null, title: 'General note' });
  assert.equal(generic.workspace.paths[generic.documentId], `notes/${generic.documentId}.md`);
  const forged = model.clone(reopened.workspace); forged.records[task].database = 'db-projects';
  await assert.rejects(reopened.save(forged), /schema mapping|properties|field|transfer/i);
});
test('moving a page rewrites incoming, outgoing, reference and image links while preserving source and identity', async t => {
  const repo = await fixture(t); await repo.createFolder('notes', 'Design (final)');
  const id = 'todo-review-comments', source = 'meeting-coordination', before = model.clone(repo.workspace.records[id]);
  let next = model.applyEdit(repo.workspace, id, '# Notes\n\n[Meeting](../meetings/meeting-coordination.md#actions "Context")\n\n`[literal](../meetings/meeting-coordination.md)`\n\n![Plan](../assets/plan.png)\n').workspace;
  await repo.save(next);
  const body = repo.workspace.records[id].body;
  await repo.moveDocument(id, 'notes/Design (final)');
  assert.equal(repo.workspace.records[id].id, before.id); assert.equal(repo.workspace.records[id].database, before.database);
  assert.deepEqual(repo.workspace.records[id].properties, before.properties);
  const meeting = repo.workspace.records[source];
  const link = model.parse(meeting.body).tasks.find(task => task.todoId === id);
  assert.equal(resolvePageLink(repo.workspace, source, link.href), id);
  assert.match(meeting.body, /Design%20%28final%29/);
  assert.match(repo.workspace.records[id].body, /\[Meeting\]\(\.\.\/\.\.\/meetings\/meeting-coordination.md#actions "Context"\)/);
  assert.match(repo.workspace.records[id].body, /`\[literal\]\(\.\.\/meetings\/meeting-coordination.md\)`/);
  assert.match(repo.workspace.records[id].body, /!\[Plan\]\(\.\.\/\.\.\/assets\/plan.png\)/);
  assert.notEqual(repo.workspace.records[id].body, body);
  await assert.rejects(fs.access(path.join(repo.root, 'todos/todo-review-comments.md')));
  const reopened = await WorkspaceRepository.open(repo.root);
  assert.equal(reopened.readOnly, false); assert.equal(reopened.workspace.paths[id], 'notes/Design (final)/todo-review-comments.md');
});
test('link rebasing changes only destinations, including nested labels, definitions and code examples', () => {
  const body = '[**Review** `](`](<../todos/task.md> "Title")\n\n[ref]: ../todos/task.md#part "ref title"\n\n[Use][ref]\n\n> [Nested](../todos/task.md)\n\n```md\n[Code](../todos/task.md)\n```\n\n[External](https://example.com/task.md)';
  const next = moveLinks(body, 'notes/source.md', 'notes/source.md', new Map([['todos/task.md', 'projects/Design/task.md']]));
  assert.match(next, /<\.\.\/projects\/Design\/task.md> "Title"/);
  assert.match(next, /\[ref\]: \.\.\/projects\/Design\/task.md#part "ref title"/);
  assert.match(next, /> \[Nested\]\(\.\.\/projects\/Design\/task.md\)/);
  assert.match(next, /```md\n\[Code\]\(\.\.\/todos\/task.md\)\n```/);
  assert.ok(next.endsWith('[External](https://example.com/task.md)'));
});
test('empty folders survive restart, remain untyped, and reject unsafe names and collisions', async t => {
  const repo = await fixture(t); await repo.createFolder('notes', 'Empty'); await repo.createFolder('notes/Empty', 'Nested');
  const reopened = await WorkspaceRepository.open(repo.root), tree = directoryTree(reopened.workspace);
  const notes = tree.folders.find(folder => folder.name === 'notes');
  assert.equal(notes.database, undefined); assert.equal(notes.folders[0].folders[0].name, 'Nested');
  for (const name of ['../escape', '.hidden', 'CON', 'bad.', 'with/slash', 'bad\nname', 'a'.repeat(256), 'Empty']) await assert.rejects(repo.createFolder('notes', name));
  await assert.rejects(repo.createFolder('', 'Notes'), /collid|exists/i);
  await assert.rejects(repo.createFolder('', 'databases'));
  await assert.rejects(repo.moveDocument('todo-review-comments', '../outside'));
  await assert.rejects(repo.moveDocument(repo.workspace.home, 'notes'));
  await assert.rejects(repo.moveDocument('todo-review-comments', 'missing'));
});
test('unknown schemas protect records wherever they live while ordinary neighbors remain editable', async t => {
  const repo = await fixture(t); await repo.moveDocument('todo-review-comments', 'notes');
  await fs.unlink(path.join(repo.root, 'databases/db-todos.md'));
  await repo.reload(); assert.ok(repo.workspace.readOnlyRecords.includes('todo-review-comments'));
  const created = model.createDocument(repo.workspace, { database: null, title: 'Still writable', folder: 'notes' });
  await repo.save(created.workspace);
  assert.match(await fs.readFile(path.join(repo.root, 'notes/todo-review-comments.md'), 'utf8'), /database: db-todos/);
});
test('external edits and folder changes prevent reorganization before changing files', async t => {
  const repo = await fixture(t);
  await fs.mkdir(path.join(repo.root, 'External'));
  await assert.rejects(repo.moveDocument('todo-review-comments', 'notes'), /changed on disk/);
  await fs.access(path.join(repo.root, 'todos/todo-review-comments.md'));
  await assert.rejects(fs.access(path.join(repo.root, 'notes/todo-review-comments.md')));
});
test('interrupted page moves recover once, retaining the original in journal history', async t => {
  const repo = await fixture(t, { beforeWrite(entry) { if (entry.after === null) throw new Error('Interrupted delete'); } });
  await assert.rejects(repo.moveDocument('todo-review-comments', 'notes'), /Interrupted delete/);
  const moved = await WorkspaceRepository.open(repo.root);
  assert.equal(moved.workspace.paths['todo-review-comments'], 'notes/todo-review-comments.md'); assert.equal(moved.readOnly, false);
  await assert.rejects(fs.access(path.join(repo.root, 'todos/todo-review-comments.md')));
  assert.ok((await fs.readdir(path.join(repo.root, '.bento-local/history'))).length);
});
test('new workspaces start with explicit memberships and dedicated schemas', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-new-layout-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repo = await create(root);
  assert.equal(Object.hasOwn(repo.view(), 'needsUpgrade'), false); assert.ok(repo.workspace.folders.includes('notes'));
  assert.equal(repo.info.databases[0].definition, 'databases/db-todos.md');
  const next = model.createDocument(repo.workspace, { database: null, title: 'Notes first' }); await repo.save(next.workspace);
  assert.equal(repo.workspace.paths[next.documentId], `notes/${next.documentId}.md`);
});

test('multiline destinations in nested blockquotes retain their surrounding Markdown', () => {
  const body = '> > [A](\n> > ../todos/task.md "title")\n\n> [ref]:\n> ../todos/task.md\n';
  const moved = new Map([['todos/task.md', 'notes/task.md']]);
  assert.equal(moveLinks(body, 'projects/a.md', 'projects/a.md', moved), body.replaceAll('../todos/task.md', '../notes/task.md'));
});
test('divergent interrupted move retains both copies and stops recovery', async t => {
  const repo = await fixture(t);
  repo.options.beforeWrite = entry => { if (entry.after === null) throw new Error('Stop before deletion'); };
  await assert.rejects(repo.moveDocument('todo-review-comments', 'notes'), /Stop before deletion/);
  const source = path.join(repo.root, 'todos/todo-review-comments.md');
  await fs.appendFile(source, '\nExternal work\n');
  const recovered = await WorkspaceRepository.open(repo.root);
  assert.equal(recovered.readOnly, true);
  assert.match(await fs.readFile(source, 'utf8'), /External work/);
  await fs.access(path.join(repo.root, 'notes/todo-review-comments.md'));
});

test('managed schema folders report misplaced content without altering it', async t => {
  const repo = await fixture(t);
  await fs.writeFile(path.join(repo.root, 'databases/external.md'), '# External notes\n');
  await repo.reload();
  assert.ok(repo.errors.some(error => error.path === 'databases/external.md' && /managed databases folder/.test(error.message)));
  assert.equal(await fs.readFile(path.join(repo.root, 'databases/external.md'), 'utf8'), '# External notes\n');
});
test('moving a page retains query-only references and directory destination semantics', () => {
  const body = '[Query](?view=notes) [Here](#part) [Assets](../assets/) [Directory](.)';
  const next = moveLinks(body, 'notes/a.md', 'projects/Design/a.md', new Map([['notes/a.md', 'projects/Design/a.md']]));
  assert.equal(next, '[Query](?view=notes) [Here](#part) [Assets](../../assets/) [Directory](../../notes/)');
});
