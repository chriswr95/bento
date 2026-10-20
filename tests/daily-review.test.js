import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import model from '../prototype/workspace.js';
import { dailyReview } from '../prototype/project-review.js';
import { nextDate } from '../prototype/due-date-picker.js';
import { WorkspaceRepository } from '../files/repository.js';

function fixture() {
  let workspace = model.createWorkspace({ coordination: '# Meeting\n', drainage: '# Drainage\n' });
  for (const [title, due, done] of [['Past', '2026-10-18', false], ['Today', '2026-10-19', false], ['Future', '2026-11-01', false], ['No date', '', false], ['Completed', '2026-10-18', true]]) {
    workspace = model.applyEdit(workspace, 'coordination', workspace.records.coordination.body + `\n- [${done ? 'x' : ' '}] ${title}${due ? ` (due ${due})` : ''}\n`).workspace;
  }
  return workspace;
}
test('daily review includes unassigned and inactive-project work exactly once', () => {
  let workspace = fixture();
  const tasks = model.allTasks(workspace);
  workspace = model.updateTodo(workspace, tasks.find(task => task.title === 'Future').id, { project: null });
  workspace = model.updateTodo(workspace, tasks.find(task => task.title === 'No date').id, { project: 'elm' });
  workspace.records.elm.properties['field-project-status'] = 'option-completed';
  const before = structuredClone(workspace), review = dailyReview(workspace, '2026-10-19');
  assert.equal(review.open, 4);
  assert.equal(review.groups.upcoming[0].project, null);
  assert.equal(review.groups.undated[0].project, 'elm');
  assert.equal(review.projects.some(summary => summary.project.id === 'elm'), false);
  assert.equal(new Set(Object.values(review.groups).flat().map(task => task.id)).size, tasks.length);
  assert.equal(review.projects[0].project.id, 'creek');
  const creek = review.projects.find(summary => summary.project.id === 'creek');
  assert.equal(creek.open, 2); assert.equal(creek.nextDue.title, 'Today');
  assert.equal(creek.groups.overdue.length, 1); assert.equal(creek.groups.completed.length, 1);
  assert.ok(review.projects.some(summary => summary.open === 0), 'Empty active projects remain visible');
  assert.deepEqual(workspace, before);
});
test('recent notes use one unambiguous date field and exclude future notes', () => {
  const workspace = fixture();
  workspace.databases['db-meetings'].fields.push({ id: 'field-meeting-date', name: 'Meeting date', type: 'date' });
  for (const [id, date] of [['coordination', '2026-10-19'], ['drainage', '2026-10-18']]) {
    workspace.records[id].properties['field-meeting-date'] = date;
    workspace.records[id].properties['field-meeting-projects'] = ['creek', 'elm'];
  }
  workspace.databases['db-meetings'].fields.push({ id: 'also-related', name: 'Also related', type: 'relation', cardinality: 'one', target_database: 'db-projects' });
  workspace.records.coordination.properties['also-related'] = 'creek';
  let creek = dailyReview(workspace, '2026-10-19').projects.find(summary => summary.project.id === 'creek');
  assert.deepEqual(creek.recentNotes.map(note => note.document.id), ['coordination', 'drainage']);
  assert.equal(creek.notes.length, 2, 'Multiple matching relations do not duplicate a note');
  workspace.records.coordination.properties['field-meeting-date'] = '2026-10-20';
  creek = dailyReview(workspace, '2026-10-19').projects.find(summary => summary.project.id === 'creek');
  assert.deepEqual(creek.recentNotes.map(note => note.document.id), ['drainage']);
  workspace.databases['db-meetings'].fields.push({ id: 'another-date', name: 'Another date', type: 'date' });
  assert.equal(dailyReview(workspace, '2026-10-19').projects.find(summary => summary.project.id === 'creek').recentNotes.length, 0);
});
test('calendar rollover moves today to overdue without moving completed or undated work', () => {
  const workspace = fixture(), review = dailyReview(workspace, '2026-10-20');
  assert.deepEqual(review.groups.overdue.map(task => task.title), ['Past', 'Today']);
  assert.equal(review.groups.today.length, 0); assert.equal(review.groups.completed.length, 1); assert.equal(review.groups.undated.length, 1);
  for (const [today, tomorrow] of [['2026-12-31', '2027-01-01'], ['2028-02-28', '2028-02-29'], ['2026-03-08', '2026-03-09'], ['2026-11-01', '2026-11-02']]) assert.equal(nextDate(today), tomorrow);
  assert.throws(() => nextDate('2026-02-30'), /date/); assert.throws(() => dailyReview(workspace, 'invalid'), /date/);
});
test('meeting capture, scheduling, next-morning review and rescheduling persist without altering notes', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'bento-review-')); t.after(() => fs.rm(folder, { recursive: true, force: true }));
  await fs.cp(new URL('../examples/document-databases', import.meta.url), folder, { recursive: true });
  let repo = await WorkspaceRepository.open(folder);
  const meeting = repo.workspace.records['meeting-coordination'];
  let next = model.applyEdit(repo.workspace, meeting.id, meeting.body + '\n- [ ] Send follow-up\n').workspace;
  const action = model.allTasks(next).find(task => task.title === 'Send follow-up');
  next.records[action.id].body = 'Include the drainage assumptions.\n';
  next = model.updateTodo(next, action.id, { due: '2026-10-19' }); await repo.save(next);
  repo = await WorkspaceRepository.open(folder);
  assert.ok(dailyReview(repo.workspace, '2026-10-20').groups.overdue.some(task => task.id === action.id));
  const meetingBefore = await fs.readFile(path.join(folder, 'meetings/meeting-coordination.md'), 'utf8');
  await repo.save(model.updateTodo(repo.workspace, action.id, { due: '2026-10-21' }));
  repo = await WorkspaceRepository.open(folder);
  assert.ok(dailyReview(repo.workspace, '2026-10-20').groups.upcoming.some(task => task.id === action.id));
  assert.equal(repo.workspace.records[action.id].body, 'Include the drainage assumptions.\n');
  assert.equal(model.taskInfo(repo.workspace, repo.workspace.records[action.id]).project, 'project-creekside');
  assert.equal(await fs.readFile(path.join(folder, 'meetings/meeting-coordination.md'), 'utf8'), meetingBefore);
  const before = structuredClone(repo.workspace);
  assert.throws(() => model.updateTodo(repo.workspace, action.id, { due: '2026-02-30' }), /date/);
  assert.deepEqual(repo.workspace, before);
  await repo.save(model.updateTodo(repo.workspace, action.id, { due: '' }));
  assert.ok(dailyReview((await WorkspaceRepository.open(folder)).workspace, '2026-10-20').groups.undated.some(task => task.id === action.id));
});
