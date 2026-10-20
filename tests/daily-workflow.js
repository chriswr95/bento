import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { WorkspaceRepository } from '../files/repository.js';
import model from '../prototype/workspace.js';

export async function checkDailyWorkflow({ launch, stop, temporary, root }) {
  const folder = path.join(temporary, 'Daily review'), userData = path.join(temporary, 'DailyReviewUser');
  await fs.cp(path.join(root, 'examples/document-databases'), folder, { recursive: true });
  let { app, page } = await launch(folder, userData);
  const title = 'Send revised drainage notes';
  const saved = () => page.locator('#b-save-state').filter({ hasText: /^Saved$/ }).waitFor();
  const row = () => page.locator('main .b-task').filter({ has: page.locator('.b-task-title').filter({ hasText: title }) });
  const reschedule = async choice => {
    await row().getByRole('button', { name: /^Due date for/ }).click();
    await page.getByRole('dialog', { name: 'Reschedule todo', exact: true }).getByRole('button', { name: choice, exact: true }).click(); await saved();
  };
  try {
    await saved(); await page.clock.setFixedTime(new Date('2026-10-19T09:00:00')); await page.reload(); await saved();
    await page.locator('aside').getByRole('button', { name: 'Weekly coordination', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Page Markdown', exact: true });
    await editor.press('ControlOrMeta+End'); await editor.press('Enter'); await editor.pressSequentially('[] ' + title); await saved();
    await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
    await reschedule('Today');
    await page.getByRole('region', { name: 'Today', exact: true }).getByRole('button', { name: title, exact: true }).waitFor();
    await row().getByRole('button', { name: title, exact: true }).click();
    await page.getByRole('textbox', { name: 'Todo Markdown', exact: true }).pressSequentially('Include marked-up drainage calculations.'); await saved();
    await page.getByRole('button', { name: 'Daily overview', exact: true }).click();
    const before = await fs.readFile(path.join(folder, 'meetings/meeting-coordination.md'), 'utf8');
    const recorded = await WorkspaceRepository.open(folder);
    const notesBefore = Object.values(recorded.workspace.records).find(record => record.title === title).body;
    await app.close(); app = null;
    ({ app, page } = await launch(null, userData));
    await saved(); await page.clock.setFixedTime(new Date('2026-10-20T09:00:00')); await page.reload(); await saved();
    await page.getByRole('region', { name: 'Overdue', exact: true }).getByRole('button', { name: title, exact: true }).waitFor();
    const card = page.getByRole('region', { name: 'Project summary: Creekside improvements', exact: true });
    assert.match(await card.innerText(), /1 overdue/);
    await card.getByRole('heading', { name: 'Recent notes', exact: true }).waitFor();
    await card.getByRole('button', { name: 'Weekly coordination', exact: true }).waitFor();
    await page.locator('#bento-workflow').screenshot({ path: path.join(root, 'work/qa/daily-review.png') });
    await reschedule('Tomorrow');
    await page.getByRole('region', { name: 'Upcoming', exact: true }).getByRole('button', { name: title, exact: true }).waitFor();
    let repo = await WorkspaceRepository.open(folder);
    const action = model.allTasks(repo.workspace).find(task => task.title === title);
    assert.equal(action.due, '2026-10-21'); assert.equal(action.project, 'project-creekside');
    assert.equal(repo.workspace.records[action.id].body, notesBefore);
    assert.equal(await fs.readFile(path.join(folder, 'meetings/meeting-coordination.md'), 'utf8'), before);
    await row().getByRole('button', { name: /Weekly coordination/ }).click();
    await page.getByRole('textbox', { name: 'Page Markdown', exact: true }).getByRole('link', { name: title, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Daily overview', exact: true }).click(); await saved();
    await app.close(); app = null;
    ({ app, page } = await launch(null, userData)); await saved();
    repo = await WorkspaceRepository.open(folder);
    assert.equal(model.taskInfo(repo.workspace, repo.workspace.records[action.id]).due, '2026-10-21');
    console.log('Passed native meeting → personal todo → Today → restart next morning → overdue → Tomorrow, project summaries, source-note links and preserved Markdown details.');
  } finally { await stop(app); }
}
