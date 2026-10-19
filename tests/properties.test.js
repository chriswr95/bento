import { test } from 'node:test';
import assert from 'node:assert/strict';
import model from '../prototype/workspace.js';
import { propertyChoices, propertyValue, escapeProperty } from '../prototype/property-editor.js';

function fixture() {
  const workspace = model.createWorkspace();
  const doc = workspace.records.creek;
  const database = workspace.databases[doc.database];
  database.fields.push(
    { id: 'text', name: 'Client', type: 'text' },
    { id: 'number', name: 'Hours', type: 'number', min: 0 },
    { id: 'boolean', name: 'Reviewed', type: 'boolean' },
    { id: 'date', name: 'Date', type: 'date' },
    { id: 'multi', name: 'Disciplines', type: 'multi-select', options: [{ id: 'civil', name: 'Civil' }] },
    { id: 'relation', name: 'Other projects', type: 'relation', target_database: 'db-projects', cardinality: 'many' }
  );
  return { workspace, doc, database };
}
test('property updates preserve Markdown, references, unmapped fields and input snapshots', () => {
  const { workspace, doc } = fixture(); doc.properties.unknown = { keep: true };
  const before = structuredClone(workspace);
  const next = model.updateDocument(workspace, doc.id, { title: ' Updated project ', tags: [' Civil ', 'Civil', 'Follow up'], properties: { 'field-project-status': 'option-completed', number: 0, boolean: false } });
  assert.equal(next.records[doc.id].title, 'Updated project');
  assert.deepEqual(next.records[doc.id].tags, ['Civil', 'Follow up']);
  assert.equal(next.records[doc.id].body, doc.body);
  assert.deepEqual(next.records[doc.id].properties.unknown, { keep: true });
  assert.deepEqual(next.records[doc.id].references, doc.references);
  assert.equal(model.activeProjects(next).some(project => project.id === doc.id), false);
  assert.deepEqual(workspace, before);
});

test('invalid metadata, unknown field edits and invalid relationships reject the entire patch', () => {
  const { workspace, doc } = fixture(), before = structuredClone(workspace);
  for (const patch of [{ title: ' ' }, { title: 'Two\nlines' }, { tags: [1] }, { database: 'db-todos' }, { properties: { unknown: 1 } }, { properties: { number: -1 } }, { properties: { relation: ['coordination'] } }]) {
    assert.throws(() => model.updateDocument(workspace, doc.id, patch));
    assert.deepEqual(workspace, before);
  }
});

test('property values decode zero, false, arrays and real dates without losing their types', () => {
  const { database } = fixture();
  const field = id => database.fields.find(field => field.id === id);
  assert.equal(propertyValue(field('number'), '0'), 0);
  assert.equal(propertyValue(field('boolean'), 'false'), false);
  assert.equal(propertyValue(field('date'), '2028-02-29'), '2028-02-29');
  assert.deepEqual(propertyValue(field('multi'), ['civil']), ['civil']);
  assert.deepEqual(propertyValue(field('relation'), ['elm', 'park']), ['elm', 'park']);
});

test('empty optional values clear explicitly while required and invalid input is rejected', () => {
  const { database } = fixture();
  const field = id => database.fields.find(field => field.id === id);
  assert.equal(propertyValue(field('text'), ''), null);
  assert.deepEqual(propertyValue(field('relation'), []), []);
  for (const [id, value] of [['number', 'NaN'], ['number', '1e309'], ['number', '-1'], ['boolean', 'yes'], ['date', '2027-02-29']]) assert.throws(() => propertyValue(field(id), value));
  field('text').required = true;
  assert.throws(() => propertyValue(field('text'), ''), /Client is required/);
});

test('relation choices include unavailable current IDs and metadata is escaped', () => {
  const { workspace, database } = fixture();
  const choices = propertyChoices(workspace, database.fields.find(field => field.id === 'relation'), ['project-missing']);
  assert.ok(choices.some(option => option.id === 'project-missing' && option.name === 'Unavailable record (project-missing)'));
  assert.doesNotMatch(escapeProperty('<script>" &'), /<script>|"/);
});

test('generic task-property updates reconcile source labels while retaining todo notes', () => {
  const workspace = model.createWorkspace(), task = model.allTasks(workspace)[0];
  const beforeBody = workspace.records[task.id].body;
  const next = model.updateDocument(workspace, task.id, { title: 'Updated task', properties: { 'field-task-status': 'option-done' } });
  assert.equal(next.records[task.id].body, beforeBody);
  assert.match(next.records.coordination.body, /\[x\] \[Updated task\]/);
});
