import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import model from '../prototype/workspace.js';
import { ancestors, canParent, pageTree } from '../prototype/page-hierarchy.js';
import { backlinks, resolvePageLink } from '../prototype/page-links.js';
import { WorkspaceRepository } from '../files/repository.js';

function withPages() {
  let workspace = model.createWorkspace();
  workspace.paths = Object.fromEntries(Object.keys(workspace.records).map(id => [id, `${id}.md`]));
  workspace.databasePaths = { 'db-todos': 'todos', 'db-projects': 'projects', 'db-meetings': 'meetings' };
  const first = model.createDocument(workspace, { database: null, title: 'Calculations', parent: 'creek' });
  workspace = first.workspace;
  const second = model.createDocument(workspace, { database: null, title: 'Assumptions', parent: first.documentId });
  return { workspace: second.workspace, first: first.documentId, second: second.documentId };
}
async function fixture(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-pages-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  await fs.cp(new URL('../examples/document-databases', import.meta.url), folder, { recursive: true });
  return folder;
}
test('subpages have one parent, independent membership and unchanged file locations', () => {
  const { workspace, first, second } = withPages();
  assert.equal(workspace.records[first].database, undefined);
  assert.equal(workspace.records[first].schema_version, undefined);
  assert.equal(workspace.paths[first], `${first}.md`);
  assert.deepEqual(ancestors(workspace, second).map(page => page.id), ['creek', first]);
  const todo = model.allTasks(workspace)[0], original = structuredClone(workspace);
  const moved = model.updateDocument(workspace, todo.id, { parent: first });
  assert.equal(moved.records[todo.id].database, workspace.records[todo.id].database);
  assert.equal(moved.paths[todo.id], workspace.paths[todo.id]);
  assert.deepEqual(moved.records[todo.id].properties, workspace.records[todo.id].properties);
  assert.deepEqual(workspace, original);
  assert.equal(model.updateDocument(moved, todo.id, { parent: null }).records[todo.id].parent, null);
});
test('cycles, multiple parents, missing targets and parenting Workspace fail atomically', () => {
  const { workspace, first, second } = withPages(), before = structuredClone(workspace);
  for (const parent of [first, second, [first, second], 'missing']) assert.throws(() => model.updateDocument(workspace, first, { parent }));
  assert.equal(canParent(workspace, first, second), false);
  workspace.home = 'creek'; delete workspace.records.creek.database; delete workspace.records.creek.schema_version;
  assert.throws(() => model.updateDocument(workspace, 'creek', { parent: first }), /Workspace page/);
  delete workspace.home; workspace.records.creek = before.records.creek;
  assert.deepEqual(workspace, before);
});
test('page tree includes each document once and retains missing-parent pages as roots', () => {
  const { workspace, first } = withPages(); workspace.records[first].parent = 'missing';
  const flat = nodes => nodes.flatMap(node => [node.page.id, ...flat(node.children)]);
  const tree = pageTree(workspace), ids = flat(tree);
  assert.ok(tree.some(node => node.page.id === first));
  assert.equal(new Set(ids).size, Object.keys(workspace.records).length);
  assert.equal(ids.length, Object.keys(workspace.records).length);
});
test('standalone creation and reparenting persist with no file moves or schema changes', async t => {
  const folder = await fixture(t), repo = await WorkspaceRepository.open(folder);
  const result = model.createDocument(repo.workspace, { database: null, title: 'Calculations', parent: 'project-creekside' });
  await repo.save(result.workspace);
  const filename = path.join(folder, `${result.documentId}.md`), before = await fs.readFile(path.join(folder, 'projects/database.md'), 'utf8');
  assert.match(await fs.readFile(filename, 'utf8'), /parent: project-creekside/);
  await repo.save(model.updateDocument(repo.workspace, result.documentId, { parent: null }));
  const reopened = await WorkspaceRepository.open(folder);
  assert.equal(reopened.workspace.records[result.documentId].parent, null);
  assert.equal(reopened.workspace.paths[result.documentId], `${result.documentId}.md`);
  assert.equal(await fs.readFile(path.join(folder, 'projects/database.md'), 'utf8'), before);
});
test('external hierarchy cycles protect files; missing parents stay readable and repairable', async t => {
  const folder = await fixture(t), repo = await WorkspaceRepository.open(folder);
  const result = model.createDocument(repo.workspace, { database: null, title: 'Orphan', parent: 'project-creekside' });
  await repo.save(result.workspace);
  await fs.unlink(path.join(folder, 'projects/project-creekside.md'));
  let loaded = await WorkspaceRepository.open(folder);
  assert.ok(loaded.workspace.records[result.documentId]); assert.equal(loaded.readOnly, false);
  assert.match(loaded.errors.map(error => error.message).join(' '), /Parent page is unavailable/);
  await loaded.save(model.updateDocument(loaded.workspace, result.documentId, { parent: null }));
  await fs.writeFile(path.join(folder, 'one.md'), '---\nid: one\nparent: two\n---\nOne');
  await fs.writeFile(path.join(folder, 'two.md'), '---\nid: two\nparent: one\n---\nTwo');
  loaded = await WorkspaceRepository.open(folder);
  assert.equal(loaded.readOnly, true);
  assert.ok(loaded.workspace.records.one); assert.ok(loaded.workspace.records.two);
  await assert.rejects(loaded.save(loaded.workspace), /repair/);
});
test('page links resolve real paths including Workspace; backlinks ignore code and deduplicate sources', () => {
  const { workspace, first, second } = withPages();
  workspace.home = 'home'; workspace.records.home = { bento_version: 1, id: 'home', title: 'Desk', tags: [], properties: {}, references: {}, body: '' }; workspace.paths.home = 'workspace.md';
  workspace.paths[first] = `Design notes/Calculations (final)/${first}.md`;
  const href = model.linkFor(workspace, second, first);
  assert.match(href, /Design%20notes/);
  workspace.records[second].body = `[Review](${href}) and [again](${href}).\n\n[Workspace](${model.linkFor(workspace, second, 'home')})\n`;
  workspace.records.coordination.body = `\`[Example](${href})\`\n\n\`\`\`md\n[Example](${href})\n\`\`\`\n`;
  assert.equal(resolvePageLink(workspace, second, href), first);
  assert.equal(resolvePageLink(workspace, second, 'workspace.md'), 'home');
  assert.deepEqual(backlinks(workspace, first).map(page => page.id), [second]);
  assert.deepEqual(backlinks(workspace, 'home').map(page => page.id), [second]);
  const renamed = model.updateDocument(workspace, first, { title: 'Renamed' });
  assert.equal(resolvePageLink(renamed, second, href), first);
  for (const invalid of ['../../outside.md', '/workspace.md', 'https://host/workspace.md', '%ZZ.md', 'missing.md']) assert.equal(resolvePageLink(workspace, second, invalid), null);
});
