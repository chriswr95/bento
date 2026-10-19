import { test } from 'node:test';
import assert from 'node:assert/strict';
import model from '../prototype/workspace.js';

function emptyWorkspace() {
  const workspace = model.createWorkspace(); workspace.records = {};
  workspace.paths = {}; workspace.databasePaths = { 'db-projects': 'projects', 'db-todos': 'todos', 'db-meetings': 'meetings' };
  return workspace;
}
test('creating a project returns its Markdown identity, schema defaults and folder path without mutating input', () => {
  const workspace = emptyWorkspace(), before = structuredClone(workspace);
  const { workspace: next, documentId } = model.createDocument(workspace, { database: 'db-projects', title: '  Drainage review  ' });
  const document = next.records[documentId];
  assert.match(documentId, /^project-/); assert.equal(document.title, 'Drainage review');
  assert.equal(document.body, '# Drainage review\n\n'); assert.equal(next.paths[documentId], `projects/${documentId}.md`);
  assert.deepEqual(model.activeProjects(next).map(record => record.id), [documentId]); assert.deepEqual(workspace, before);
});
test('new meeting notes link to a project and checkbox capture inherits it', () => {
  const project = model.createDocument(emptyWorkspace(), { database: 'db-projects', title: 'Creekside' });
  const meeting = model.createDocument(project.workspace, { database: 'db-meetings', title: 'Coordination', properties: { 'field-meeting-projects': [project.documentId] } });
  const next = model.applyEdit(meeting.workspace, meeting.documentId, '# Coordination\n\n- [ ] Review drawings\n').workspace;
  assert.equal(model.allTasks(next)[0].project, project.documentId);
});
test('invalid titles, databases and property values reject creation without modifying workspace', () => {
  const workspace = emptyWorkspace(), before = structuredClone(workspace);
  for (const title of ['', '   ', 'x'.repeat(201), 'Two\nlines']) assert.throws(() => model.createDocument(workspace, { database: 'db-projects', title }), /title/);
  assert.throws(() => model.createDocument(workspace, { database: 'missing', title: 'Project' }), /existing database/);
  assert.throws(() => model.createDocument(workspace, { database: 'db-projects', title: 'Project', properties: { 'field-project-status': 'invalid' } }));
  assert.deepEqual(workspace, before);
});
test('required custom fields reject incomplete creation and accept valid values at the current schema version', () => {
  const workspace = emptyWorkspace(), database = workspace.databases['db-projects']; database.schema_version = 2;
  database.fields.push({ id: 'field-client', name: 'Client', type: 'text', required: true });
  assert.throws(() => model.createDocument(workspace, { database: database.id, title: 'Project' }), /Client/);
  const result = model.createDocument(workspace, { database: database.id, title: 'Project', properties: { 'field-client': 'City' } });
  assert.equal(result.workspace.records[result.documentId].schema_version, 2);
});
test('duplicate project titles have separate identities and Markdown formatting stays literal', () => {
  const first = model.createDocument(emptyWorkspace(), { database: 'db-projects', title: 'Plan [A] *review*' });
  const second = model.createDocument(first.workspace, { database: 'db-projects', title: 'Plan [A] *review*' });
  assert.notEqual(first.documentId, second.documentId);
  assert.equal(second.workspace.records[second.documentId].body, '# Plan \\[A\\] \\*review\\*\n\n');
});

test('standalone todos initialize completion without duplicating their title in body notes', () => {
  const result = model.createDocument(emptyWorkspace(), { database: 'db-todos', title: 'Review comments' });
  assert.equal(model.taskInfo(result.workspace, result.workspace.records[result.documentId]).done, false);
  assert.equal(result.workspace.records[result.documentId].body, '');
});
