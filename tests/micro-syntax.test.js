import { test } from 'node:test';
import assert from 'node:assert/strict';
import model from '../prototype/workspace.js';
import { propertyQuery, matchingProperties, entryFields, microPatch, valueChoices, microLabel } from '../prototype/micro-syntax.js';

test('micro queries match bounded literal names after @ at token boundaries, including trailing spaces', () => {
  assert.deepEqual(propertyQuery('Trim trees @da '), { from: 11, to: 15, text: 'da' });
  assert.deepEqual(propertyQuery('@'), { from: 0, to: 1, text: '' });
  assert.equal(propertyQuery('mail@example.com'), null);
  assert.equal(propertyQuery('@' + 'a'.repeat(65)), null);
  assert.equal(propertyQuery('@date\nnext'), null);
  const fields = [{ id: 'date', name: 'Due date' }, { id: 'other', name: 'Update time' }];
  assert.deepEqual(matchingProperties(fields, 'DA').map(field => field.id), ['date', 'other']);
  assert.deepEqual(matchingProperties(fields, '['), []);
  assert.deepEqual(matchingProperties([{ name: 'Révision' }], 'revision'), [{ name: 'Révision' }]);
});
test('typed micro values validate before mutation and preserve false, zero, choices and relation IDs', () => {
  assert.deepEqual(microPatch({ id: 'hours', name: 'Hours', type: 'number', min: 0 }, '0'), { properties: { hours: 0 } });
  assert.deepEqual(microPatch({ id: 'ready', type: 'boolean' }, 'false'), { properties: { ready: false } });
  assert.throws(() => microPatch({ id: 'date', name: 'Date', type: 'date' }, '2026-02-30'), /Invalid/);
  assert.throws(() => microPatch({ id: 'hours', name: 'Hours', type: 'number', min: 0 }, '-1'), /Invalid/);
  assert.throws(() => microPatch({ id: 'client', name: 'Client', type: 'text', required: true }, ''), /required/);
  assert.deepEqual(microPatch({ id: '$tags', type: 'tags' }, 'client, internal\nFollow up\nFollow up'), { tags: ['client, internal', 'Follow up'] });
  assert.throws(() => microPatch({ id: '$color', type: 'color' }, 'invisible'), /colors/);
});
test('property search is driven by database definitions and relations resolve canonical identities', () => {
  const workspace = model.createWorkspace(), database = workspace.databases['db-todos'];
  database.fields[1].name = 'Submission deadline';
  assert.ok(entryFields(workspace, database.id).some(field => field.name === 'Submission deadline'));
  const relation = database.fields.find(field => field.type === 'relation');
  const choice = valueChoices(workspace, relation, null).find(choice => choice.id === 'elm');
  assert.ok(choice);
  const before = structuredClone(workspace), patch = microPatch(relation, choice.id);
  const created = model.createDocument(workspace, { database: database.id, title: 'Permit application', properties: patch.properties });
  assert.equal(created.workspace.records[created.documentId].properties[relation.id], 'elm');
  assert.deepEqual(workspace, before);
});

test('visible micro labels use readable values while canonical patches retain their types and IDs', () => {
  const workspace = model.createWorkspace(), relation = workspace.databases['db-todos'].fields.find(field => field.type === 'relation');
  assert.equal(microLabel(workspace, relation, 'elm'), '@Project(Elm Street drainage)');
  assert.equal(microLabel(workspace, { id: 'ready', name: 'Ready', type: 'boolean' }, false), '@Ready(No)');
  assert.equal(microLabel(workspace, { id: 'hours', name: 'Hours', type: 'number' }, 0), '@Hours(0)');
  assert.deepEqual(microPatch(relation, 'elm'), { properties: { [relation.id]: 'elm' } });
});
