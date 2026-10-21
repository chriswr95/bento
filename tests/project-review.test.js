import { test } from 'node:test';
import assert from 'node:assert/strict';
import model from '../prototype/workspace.js';
import { projectReview, databaseProjectReviews } from '../prototype/project-review.js';

function fixture() {
  let workspace = model.createWorkspace({ coordination: '# Meeting\n', drainage: '# Drainage\n' });
  for (const [title, due, done] of [['Past', '2026-10-18', false], ['Today', '2026-10-19', false], ['Future', '2026-11-01', false], ['No date', '', false], ['Completed', '2026-10-18', true]]) {
    workspace = model.applyEdit(workspace, 'coordination', workspace.records.coordination.body + `\n- [${done ? 'x' : ' '}] ${title}${due ? ` (due ${due})` : ''}\n`).workspace;
  }
  return workspace;
}
test('project database cards include inactive and empty projects, use capabilities, and stay within their database', () => {
  const workspace = fixture();
  workspace.databases['custom-projects'] = { ...workspace.databases['db-projects'], id: 'custom-projects', title: 'Client work' };
  workspace.records.park.database = 'custom-projects';
  workspace.records.elm.properties['field-project-status'] = 'option-completed';
  const before = structuredClone(workspace);
  const reviews = databaseProjectReviews(workspace, 'db-projects', '2026-10-19');
  assert.deepEqual(reviews.map(review => review.project.id).sort(), ['creek', 'elm']);
  assert.equal(reviews.find(review => review.project.id === 'elm').status, 'Completed');
  assert.equal(reviews.find(review => review.project.id === 'creek').open, 4);
  assert.equal(databaseProjectReviews(workspace, 'custom-projects', '2026-10-19')[0].open, 0);
  assert.deepEqual(databaseProjectReviews(workspace, 'db-meetings', '2026-10-19'), []);
  assert.deepEqual(workspace, before);
});
test('review partitions personal work by calendar day and completion with no duplicates', () => {
  const workspace = fixture(), before = structuredClone(workspace), review = projectReview(workspace, 'creek', '2026-10-19');
  for (const [group, title] of [['overdue', 'Past'], ['today', 'Today'], ['upcoming', 'Future'], ['undated', 'No date'], ['completed', 'Completed']]) assert.deepEqual(review.groups[group].map(task => task.title), [title]);
  assert.equal(review.open, 4); assert.deepEqual(workspace, before);
});
test('a note related to several projects appears once in each project review without changing task ownership', () => {
  const workspace = fixture(); workspace.records.coordination.properties['field-meeting-projects'] = ['creek', 'elm'];
  const review = projectReview(workspace, 'elm', '2026-10-19');
  assert.equal(review.notes.filter(note => note.id === 'coordination').length, 1);
  assert.equal(review.open, 0); assert.equal(projectReview(workspace, 'creek', '2026-10-19').open, 4);
});
test('review includes one-cardinality note relations through custom field definitions', () => {
  const workspace = fixture(); workspace.databases['db-meetings'].fields.push({ id: 'custom-project', name: 'Client project', type: 'relation', cardinality: 'one', target_database: 'db-projects' });
  workspace.records.drainage.properties['custom-project'] = 'park';
  assert.deepEqual(projectReview(workspace, 'park', '2026-10-19').notes.map(note => note.id), ['drainage']);
});
test('empty and inactive projects still have a review, while invalid projects and dates are rejected', () => {
  const workspace = fixture(); workspace.records.park.properties['field-project-status'] = 'option-completed';
  const review = projectReview(workspace, 'park', '2026-10-19'); assert.equal(review.open, 0); assert.deepEqual(review.notes, []);
  assert.throws(() => projectReview(workspace, 'missing', '2026-10-19'), /Project/);
  assert.throws(() => projectReview(workspace, 'creek', '2026-02-30'), /date/);
});
