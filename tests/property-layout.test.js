import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WorkspaceRepository } from '../files/repository.js';
import { propertyLayout, validateLayout, withPropertyLayout } from '../prototype/property-layout.js';
import model from '../prototype/workspace.js';
import * as markdown from '../files/markdown.js';

test('layout keeps mandatory fields visible and separates presentation from validation and data', () => {
  const workspace = model.createWorkspace(), database = workspace.databases['db-projects'];
  database.fields.push({ id: 'client', name: 'Client', type: 'text', required: true, default: 'Town' });
  const layout = propertyLayout(database);
  assert.deepEqual(layout.required, ['client']);
  assert.deepEqual(layout.detail, ['$color', '$tags']);
  assert.deepEqual(layout.important, ['field-project-status']);
  const next = withPropertyLayout(workspace, database.id, { important: ['$tags'], detail: ['field-project-status', '$color'] });
  assert.deepEqual(next.records, workspace.records);
  assert.deepEqual(next.databases[database.id].fields, database.fields);
  assert.equal(next.databases[database.id].schema_version, database.schema_version);
  assert.deepEqual(propertyLayout(next.databases[database.id]).required, ['client']);
  for (const invalid of [null, [], {}, { important: 'all', detail: [] }, { important: ['missing'], detail: [] }, { important: ['$tags'], detail: ['$tags'] }, { important: ['client'], detail: [] }, { important: [], detail: ['client'] }, { important: [], detail: [], unknown: [] }]) assert.throws(() => validateLayout(database, invalid));
  assert.throws(() => withPropertyLayout(workspace, 'missing', layout), /available/);
});

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-layout-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.cp(new URL('../examples/document-databases/', import.meta.url), root, { recursive: true });
  return root;
}

test('a layout writes only its authored database definition and survives restart with unknown metadata and notes', async t => {
  const root = await fixture(t), file = path.join(root, 'meetings/database.md');
  let raw = await fs.readFile(file, 'utf8');
  raw = raw.replace('fields:', 'custom_setting: keep # retained comment\nfields:');
  await fs.writeFile(file, raw);
  const repo = await WorkspaceRepository.open(root), before = new Map(repo.files);
  const layout = { important: ['field-meeting-projects', '$tags'], detail: ['field-meeting-date', '$color'] };
  await repo.setPropertyLayout('db-meetings', layout);
  const reopened = await WorkspaceRepository.open(root);
  assert.deepEqual(reopened.workspace.databases['db-meetings'].property_layout, layout);
  for (const [filename, original] of before) if (filename !== 'meetings/database.md') assert.equal(await fs.readFile(path.join(root, filename), 'utf8'), original);
  const after = await fs.readFile(file, 'utf8');
  assert.match(after, /custom_setting: keep # retained comment/);
  assert.equal(markdown.parse(after).body, markdown.parse(raw).body);
  assert.deepEqual(reopened.workspace.databases['db-meetings'].fields, repo.workspace.databases['db-meetings'].fields);
  await reopened.setPropertyLayout('db-meetings', layout);
  assert.equal(await fs.readFile(file, 'utf8'), after);
});

test('layout rejects invalid schema patches and external edits without overwriting either', async t => {
  const root = await fixture(t), file = path.join(root, 'meetings/database.md');
  const repo = await WorkspaceRepository.open(root), original = await fs.readFile(file, 'utf8');
  await assert.rejects(repo.setPropertyLayout('db-meetings', { important: ['unknown'], detail: [] }), /unknown/);
  assert.equal(await fs.readFile(file, 'utf8'), original);
  const external = original + '\nExternal note\n'; await fs.writeFile(file, external);
  await assert.rejects(repo.setPropertyLayout('db-meetings', { important: ['$tags'], detail: [] }), /changed on disk/);
  assert.equal(await fs.readFile(file, 'utf8'), external);
});

test('layout journals recoverable schema writes and refuses unavailable definitions', async t => {
  const root = await fixture(t), file = path.join(root, 'meetings/database.md');
  const original = await fs.readFile(file, 'utf8');
  const repo = await WorkspaceRepository.open(root, { beforeWrite() { throw new Error('Interrupted layout'); } });
  await assert.rejects(repo.setPropertyLayout('db-meetings', { important: ['$tags'], detail: [] }), /Interrupted/);
  const reopened = await WorkspaceRepository.open(root);
  assert.deepEqual(reopened.workspace.databases['db-meetings'].property_layout, { important: ['$tags'], detail: [] });
  assert.equal(markdown.parse(await fs.readFile(file, 'utf8')).body, markdown.parse(original).body);
  await fs.rm(file); const unavailable = await WorkspaceRepository.open(root);
  await assert.rejects(unavailable.setPropertyLayout('db-meetings', { important: [], detail: [] }), /available/);
  assert.ok(reopened.workspace.databases['db-meetings']);
});
