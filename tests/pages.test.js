import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import model from '../prototype/workspace.js';
import { backlinks, resolvePageLink } from '../prototype/page-links.js';
import { WorkspaceRepository } from '../files/repository.js';

function withPages() {
  let workspace = model.createWorkspace();
  workspace.paths = Object.fromEntries(Object.keys(workspace.records).map(id => [id, `${id}.md`]));
  workspace.databasePaths = { 'db-todos': 'todos', 'db-projects': 'projects', 'db-meetings': 'meetings' };
  const first = model.createDocument(workspace, { database: null, title: 'Calculations' });
  workspace = first.workspace;
  const second = model.createDocument(workspace, { database: null, title: 'Assumptions' });
  return { workspace: second.workspace, first: first.documentId, second: second.documentId };
}
async function fixture(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-pages-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  await fs.cp(new URL('../examples/document-databases', import.meta.url), folder, { recursive: true });
  return folder;
}
test('standalone documents have no hierarchy and reject parenting operations atomically', () => {
  const { workspace, first } = withPages(), before = structuredClone(workspace);
  assert.equal(workspace.records[first].database, undefined);
  assert.equal(workspace.records[first].schema_version, undefined);
  assert.equal(workspace.records[first].parent, undefined);
  assert.equal(workspace.paths[first], `${first}.md`);
  assert.throws(() => model.createDocument(workspace, { database: null, title: 'Nested', parent: first }), /Only database/);
  assert.throws(() => model.updateDocument(workspace, first, { parent: 'creek' }), /Only document/);
  assert.deepEqual(workspace, before);
});
test('standalone creation persists without changing existing files or database schemas', async t => {
  const folder = await fixture(t), repo = await WorkspaceRepository.open(folder);
  const filename = path.join(folder, 'projects/project-creekside.md'), before = await fs.readFile(filename, 'utf8');
  const result = model.createDocument(repo.workspace, { database: null, title: 'Calculations' });
  await repo.save(result.workspace);
  const reopened = await WorkspaceRepository.open(folder);
  assert.equal(reopened.workspace.paths[result.documentId], `${result.documentId}.md`);
  assert.equal(reopened.workspace.records[result.documentId].parent, undefined);
  assert.equal(await fs.readFile(filename, 'utf8'), before);
});
test('legacy parent metadata is inert and preserved without projecting or restoring links', async t => {
  const folder = await fixture(t);
  await fs.writeFile(path.join(folder, 'one.md'), '---\nid: one\nparent: two # retained legacy metadata\n---\n[Two](two.md)\n');
  await fs.writeFile(path.join(folder, 'two.md'), '---\nid: two\nparent: one\n---\nTwo\n');
  await fs.writeFile(path.join(folder, 'orphan.md'), '---\nid: orphan\nparent: missing\n---\nOrphan\n');
  const repo = await WorkspaceRepository.open(folder);
  assert.equal(repo.readOnly, false);
  assert.equal(repo.errors.some(error => /Parent|hierarchy|cycle/.test(error.message)), false);
  assert.equal(repo.workspace.records.two.body, 'Two\n');
  const next = model.applyEdit(repo.workspace, 'one', 'Replacement notes.\n').workspace;
  assert.equal(next.records.one.body, 'Replacement notes.\n');
  await repo.save(next);
  const saved = await fs.readFile(path.join(folder, 'one.md'), 'utf8');
  assert.match(saved, /parent: two # retained legacy metadata/);
  assert.doesNotMatch(saved, /\[Two\]/);
  const reopened = await WorkspaceRepository.open(folder);
  assert.equal(reopened.workspace.paths.one, 'one.md');
  assert.equal(reopened.workspace.records.one.parent, 'two');
  assert.equal(reopened.workspace.records.one.body, 'Replacement notes.\n');
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
