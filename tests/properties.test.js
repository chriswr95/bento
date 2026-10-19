import { test } from 'node:test';
import assert from 'node:assert/strict';
import model from '../prototype/workspace.js';
import { propertyForm, propertyPatch } from '../prototype/property-editor.js';

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
function values(entries) {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
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

test('property form decodes typed values, preserves zero/false and accepts tags with spaces and commas', () => {
  const { workspace, doc } = fixture();
  const patch = propertyPatch(workspace, doc, values([
    ['title', 'Project'], ['tags', 'client, internal\nFollow up\nFollow up'],
    ['property:field-project-status', 'option-active'], ['property:text', 'City'],
    ['property:number', '0'], ['property:boolean', 'false'], ['property:date', '2028-02-29'],
    ['property:multi', 'civil'], ['property:relation', 'elm'], ['property:relation', 'park']
  ]));
  assert.deepEqual(patch.tags, ['client, internal', 'Follow up']);
  assert.equal(patch.properties.number, 0); assert.equal(patch.properties.boolean, false);
  assert.deepEqual(patch.properties.multi, ['civil']); assert.deepEqual(patch.properties.relation, ['elm', 'park']);
  model.updateDocument(workspace, doc.id, patch);
});

test('unchanged unset fields remain absent; clearing existing values is explicit', () => {
  const { workspace, doc } = fixture();
  let patch = propertyPatch(workspace, doc, values([['title', doc.title], ['property:field-project-status', 'option-active']]));
  assert.equal(Object.hasOwn(patch.properties, 'boolean'), false);
  doc.properties.boolean = false; doc.properties.relation = ['elm'];
  patch = propertyPatch(workspace, doc, values([['title', doc.title], ['property:field-project-status', 'option-active']]));
  assert.equal(patch.properties.boolean, null); assert.deepEqual(patch.properties.relation, []);
});

test('required values, malformed numbers and impossible dates are rejected before applying form changes', () => {
  const { workspace, doc, database } = fixture();
  for (const [key, value] of [['number', 'NaN'], ['number', '1e309'], ['boolean', 'yes'], ['date', '2027-02-29']]) {
    assert.throws(() => propertyPatch(workspace, doc, values([['title', 'Project'], ['property:' + key, value]])));
  }
  database.fields.find(field => field.id === 'text').required = true;
  assert.throws(() => propertyPatch(workspace, doc, values([['title', 'Project']])), /Client is required/);
});

test('forms escape metadata, preserve unavailable relation IDs and disable editing for read-only workspaces', () => {
  const { workspace, doc } = fixture(); doc.title = '<script>alert(1)</script>'; doc.tags = ['</textarea><img src=x>'];
  doc.properties.relation = ['project-missing'];
  const html = propertyForm(workspace, doc, true);
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /Unavailable record \(project-missing\)/);
  assert.match(html, /value="project-missing" checked/);
  assert.match(html, /fieldset class="b-property-fields" disabled/);
});

test('generic task-property updates reconcile source labels while retaining todo notes', () => {
  const workspace = model.createWorkspace(), task = model.allTasks(workspace)[0];
  const beforeBody = workspace.records[task.id].body;
  const next = model.updateDocument(workspace, task.id, { title: 'Updated task', properties: { 'field-task-status': 'option-done' } });
  assert.equal(next.records[task.id].body, beforeBody);
  assert.match(next.records.coordination.body, /\[x\] \[Updated task\]/);
});
